use std::{
    fs::{copy, create_dir_all, metadata, read, read_dir, remove_file, File},
    io::Write,
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::{DateTime, FixedOffset, Local};
use filetime::FileTime;
use glam::{Mat4, Vec3};
use gltf::Gltf;
use hashbrown::{hash_map::Entry, HashMap, HashSet};
use rand::Rng;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use thiserror::Error;
use uuid::Uuid;

pub const LIBRARY_STORAGE: &str = "snowflake.json";
pub const IMAGE_ASSETS: &str = "images";
pub const MODEL_ASSETS: &str = "models";
pub const CACHE: &str = "cache";
pub const DATA: &str = "app_meta.json";
pub const SETTINGS: &str = "resources/settings_default.json";

#[derive(Debug, Error)]
pub enum AppError {
    #[error("Invalid library.")]
    InvalidLibrary,
    #[error("Io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
    #[error("Image error: {0}")]
    Image(#[from] imagesize::ImageError),
    #[error("Asset {0:?} not found.")]
    AssetNotFound(AssetId),
    #[error("Folder at {0} is not empty.")]
    FolderNotEmpty(PathBuf),
    #[error("Collection {0:?} not found.")]
    CollectionNotFound(CollectionId),
    #[error("Tag {0:?} not found.")]
    TagNotFound(TagId),
    #[error("Illegal collection modification: {0:?}")]
    IllegalCollectionModification(CollectionId),
}

pub type AppResult<T> = Result<T, AppError>;

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum SettingsDefault {
    Selection {
        default: String,
        candidates: Vec<String>,
    },
    Sequence(Vec<String>),
    Toggle(bool),
    Float(f32),
}

impl SettingsDefault {
    pub fn default_value(self) -> SettingsValue {
        match self {
            SettingsDefault::Selection { default, .. } => SettingsValue::Name(default),
            SettingsDefault::Sequence(vec) => SettingsValue::Sequence(vec),
            SettingsDefault::Toggle(enabled) => SettingsValue::Toggle(enabled),
            SettingsDefault::Float(val) => SettingsValue::Float(val),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum SettingsValue {
    Name(String),
    Toggle(bool),
    Sequence(Vec<String>),
    Float(f32),
}

impl SettingsValue {
    pub fn to_object<T: DeserializeOwned>(self) -> Option<T> {
        match self {
            SettingsValue::Name(name) => T::deserialize(&serde_json::Value::String(name)).ok(),
            SettingsValue::Toggle(b) => T::deserialize(&serde_json::Value::Bool(b)).ok(),
            SettingsValue::Sequence(vec) => T::deserialize(&serde_json::Value::Array(
                vec.into_iter()
                    .map(|x| serde_json::Value::String(x))
                    .collect(),
            ))
            .ok(),
            SettingsValue::Float(f) => T::deserialize(&serde_json::Value::Number(
                serde_json::Number::from_f64(f as f64)?,
            ))
            .ok(),
        }
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
pub struct UserSettings(HashMap<String, HashMap<String, SettingsValue>>);

impl Deref for UserSettings {
    type Target = HashMap<String, HashMap<String, SettingsValue>>;

    fn deref(&self) -> &Self::Target {
        &self.0
    }
}

impl DerefMut for UserSettings {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.0
    }
}

impl UserSettings {
    pub fn fill_if_none(&mut self, cache: &ResourceCache) {
        for (category, items) in &cache.settings {
            let current = self.entry(category.clone()).or_default();

            for (item, default) in items {
                match current.entry(item.clone()) {
                    Entry::Occupied(_) => {}
                    Entry::Vacant(e) => {
                        e.insert(default.clone().default_value());
                    }
                }
            }
        }
    }

    pub fn get(&self, category: &str, item: &str) -> Option<&SettingsValue> {
        self.0.get(category).and_then(|c| c.get(item))
    }

    pub fn get_as<T: DeserializeOwned>(&self, category: &str, item: &str) -> Option<T> {
        self.get(category, item)
            .and_then(|value| value.clone().to_object())
    }
}

pub struct ResourceCache {
    pub settings: HashMap<String, HashMap<String, SettingsDefault>>,
}

impl ResourceCache {
    pub fn new(app: &AppHandle) -> AppResult<Self> {
        Ok(Self {
            settings: serde_json::from_slice(&read(app.path().resource_dir()?.join(SETTINGS))?)?,
        })
    }
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub recent_libs: HashMap<PathBuf, RecentLib>,
    pub settings: UserSettings,
}

impl AppData {
    pub fn read(app: &AppHandle) -> AppResult<Self> {
        let data_dir = app.path().app_data_dir()?;
        let dir = data_dir.join(DATA);

        #[cfg(debug_assertions)]
        let debug = true;
        #[cfg(not(debug_assertions))]
        let debug = false;

        let mut data = if !dir.exists() || debug {
            Self::default()
        } else {
            let mut data = serde_json::from_reader::<_, Self>(File::open(dir)?)?;
            data.recent_libs = data
                .recent_libs
                .into_iter()
                .filter(|(p, _)| validate_library(p, false))
                .collect();

            data
        };

        data.settings
            .fill_if_none(app.state::<ResourceCache>().inner());
        data.save(app)?;
        Ok(data)
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), AppError> {
        let data_dir = app.path().app_data_dir()?;
        let dir = data_dir.join(DATA);
        Ok(std::fs::write(dir, serde_json::to_string(self)?)?)
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RecentLib {
    pub path: PathBuf,
    pub name: String,
    pub last_open: DateTime<FixedOffset>,
}

#[derive(Debug)]
struct FolderAsTag<'a> {
    root_collection: CollectionId,
    tags: &'a mut HashMap<TagId, Tag>,
    collections: &'a mut HashMap<CollectionId, Collection>,
    folder_tags: &'a mut HashMap<PathBuf, TagId>,
    folder_collections: &'a mut HashMap<PathBuf, CollectionId>,
}

fn collect_path<'a>(
    root: &Path,
    path: PathBuf,
    assets: &mut HashMap<AssetId, Asset>,
    asset_crc: &mut HashMap<AssetId, u32>,
    folder_as_tag: &mut Option<FolderAsTag<'a>>,
) -> AppResult<()> {
    fn retrace_path_collections<'a>(
        current: &Path,
        folder_as_tag: &mut FolderAsTag<'a>,
    ) -> Option<CollectionId> {
        if let Some(collection) = folder_as_tag.folder_collections.get(current) {
            Some(*collection)
        } else {
            let parent = retrace_path_collections(current.parent()?, folder_as_tag)?;
            let collection = Collection::new(
                Some(parent),
                Some(Color::random()),
                current.file_stem().unwrap().to_string_lossy().to_string(),
            );
            folder_as_tag
                .folder_collections
                .insert(current.to_path_buf(), collection.id);
            folder_as_tag
                .collections
                .insert(collection.id, collection.clone());
            folder_as_tag
                .collections
                .get_mut(&parent)
                .unwrap()
                .children
                .insert(collection.id);
            Some(collection.id)
        }
    }

    let std_meta = metadata(&path)?;
    let meta = Metadata::from_std_meta(&std_meta);
    let name = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if path.is_dir() {
        let dir_entries = read_dir(&path)?.collect::<Vec<_>>();

        if dir_entries.is_empty() {
            return Ok(());
        }

        for entry in dir_entries {
            collect_path(root, entry?.path(), assets, asset_crc, folder_as_tag)?;
        }

        Ok(())
    } else if path.is_file() {
        let ext = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let file_content = read(&path)?;
        let crc = crc32fast::hash(&file_content);

        let Some(ty) = AssetType::from_ext(&ext) else {
            return Ok(());
        };

        let props = match ty {
            AssetType::RasterGraphics => {
                let size = imagesize::size(&path)?;
                AssetProperty::RasterGraphics(RasterGraphicsProperty::new(size))
            }
            AssetType::VectorGraphics => {
                if let Some(prop) = VectorGraphicsProperty::new(file_content) {
                    AssetProperty::VectorGraphics(prop)
                } else {
                    return Ok(());
                }
            }
            AssetType::GltfModel => {
                if let Some(props) = GltfModelProperty::new(&file_content) {
                    AssetProperty::GltfModel(props)
                } else {
                    return Ok(());
                }
            }
        };

        let mut asset = Asset::new(name, ext.into(), meta, ty, props, Default::default());
        if let Some(folder_as_tag) = folder_as_tag.as_mut() {
            let parent_path = path.parent().unwrap();

            let tag = match folder_as_tag.folder_tags.get(parent_path) {
                Some(tag_id) => folder_as_tag.tags[tag_id].clone(),
                None => {
                    let parent = parent_path
                        .parent()
                        .and_then(|grandparent| {
                            retrace_path_collections(grandparent, folder_as_tag)
                        })
                        .unwrap_or(folder_as_tag.root_collection);

                    let mut tag = Tag::new(
                        parent_path
                            .file_stem()
                            .unwrap()
                            .to_string_lossy()
                            .to_string(),
                        parent,
                    );
                    if parent != folder_as_tag.root_collection {
                        tag.group = Some(parent);
                    }

                    tag.color = folder_as_tag.collections[&parent].color;
                    folder_as_tag
                        .folder_tags
                        .insert(parent_path.to_path_buf(), tag.id);
                    folder_as_tag.tags.insert(tag.id, tag.clone());
                    tag
                }
            };

            folder_as_tag
                .collections
                .get_mut(&tag.parent)
                .unwrap()
                .content
                .insert(tag.id);
            asset.tags.insert_unchecked(&tag);
        }

        // Copy to preserve metadata
        copy(&path, asset.get_file_path(root))?;
        asset_crc.insert(asset.id, crc);
        assets.insert(asset.id, asset);

        Ok(())
    } else {
        unreachable!()
    }
}

#[derive(Serialize, Default)]
pub struct DuplicateAssets(pub HashMap<u32, Vec<AssetId>>);

impl DuplicateAssets {
    pub fn reduce(self) -> Option<Self> {
        (!self.0.is_empty()).then_some(self)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FolderId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AssetId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TagId(pub Uuid);

// Backward compatibility 0.1.0 (Default)
#[derive(Serialize, Deserialize, Default, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct CollectionId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum IdType {
    Asset,
    Collection,
    Tag,
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub struct ItemId {
    pub ty: IdType,
    pub id: Uuid,
}

impl ItemId {
    pub fn asset(self) -> AssetId {
        assert_eq!(self.ty, IdType::Asset);
        AssetId(self.id)
    }

    pub fn collection(self) -> CollectionId {
        assert_eq!(self.ty, IdType::Collection);
        CollectionId(self.id)
    }

    pub fn tag(self) -> TagId {
        assert_eq!(self.ty, IdType::Tag);
        TagId(self.id)
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum Item {
    Asset(Asset),
    Collection(Collection),
    Tag(Tag),
}

#[derive(Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LibraryStatistics {
    pub total_assets: u32,
    pub asset_ext: HashMap<Arc<str>, u32>,
}

#[derive(Default)]
pub struct StorageCache {
    pub root: PathBuf,
    pub asset_crc: HashMap<AssetId, u32>,
    pub crc_lookup: HashMap<u32, Vec<AssetId>>,
}

impl StorageCache {
    pub fn build(root: &Path, asset_crc: HashMap<AssetId, u32>) -> StorageCache {
        let mut crc_lookup = HashMap::<u32, Vec<AssetId>>::default();
        for (asset, crc) in &asset_crc {
            match crc_lookup.entry(*crc) {
                Entry::Occupied(mut e) => e.get_mut().push(*asset),
                Entry::Vacant(e) => {
                    e.insert(vec![*asset]);
                }
            }
        }

        Self {
            root: root.to_path_buf(),
            asset_crc,
            crc_lookup,
        }
    }

    pub fn add_asset(&mut self, crc: u32, asset: AssetId) -> Option<DuplicateAssets> {
        self.asset_crc.insert(asset, crc);

        match self.crc_lookup.entry(crc) {
            Entry::Occupied(mut e) => {
                e.get_mut().push(asset);
                Some(DuplicateAssets(HashMap::from([(
                    *e.key(),
                    e.get().clone(),
                )])))
            }
            Entry::Vacant(e) => {
                e.insert(vec![asset]);
                None
            }
        }
    }

    pub fn remove_asset(&mut self, asset: AssetId) {
        let Some(crc) = self.asset_crc.remove(&asset) else {
            return;
        };

        let Some(dup) = self.crc_lookup.get_mut(&crc) else {
            return;
        };

        for i in 0..dup.len() {
            if dup[i] == asset {
                dup.remove(i);
                return;
            }
        }

        if dup.is_empty() {
            self.crc_lookup.remove(&crc);
        }
    }

    pub fn get_all_duplication(&self) -> HashMap<u32, Vec<AssetId>> {
        self.crc_lookup
            .clone()
            .into_iter()
            .filter(|(_, d)| d.len() > 1)
            .collect()
    }

    pub fn get_duplications(&self, crcs: Vec<u32>) -> HashMap<u32, Vec<AssetId>> {
        crcs.into_iter()
            .filter_map(|crc| self.crc_lookup.get(&crc).map(|assets| (crc, assets)))
            .filter(|(_, assets)| assets.len() > 1)
            .map(|(crc, assets)| (crc.clone(), assets.clone()))
            .collect()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LibraryMeta {
    pub name: String,
    pub meta: Metadata,
}

impl Default for LibraryMeta {
    fn default() -> Self {
        Self {
            name: Default::default(),
            meta: Metadata {
                byte_size: 0,
                created_at: None,
                last_modified: Local::now().into(),
            },
        }
    }
}

impl LibraryMeta {
    pub fn new(name: String) -> Self {
        Self {
            name,
            meta: Metadata {
                byte_size: 0,
                created_at: Some(Local::now().into()),
                last_modified: Local::now().into(),
            },
        }
    }
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RecycleBin {
    pub assets: HashSet<AssetId>,
}

#[derive(Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct SpecialCollections {
    pub root: CollectionId,
}

impl SpecialCollections {
    pub fn is_special(&self, id: CollectionId) -> bool {
        id == self.root
    }
}

#[derive(Serialize, Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum TagGroupConflictResolve {
    Override,
    Remove,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]

pub struct StorageConstructionSettings {
    pub src_root: PathBuf,
    pub root: PathBuf,
    pub folder_as_tag: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Storage {
    #[serde(skip)]
    pub cache: StorageCache,
    pub sp_collections: SpecialCollections,
    pub tags: HashMap<TagId, Tag>,
    pub collections: HashMap<CollectionId, Collection>,
    pub assets: HashMap<AssetId, Asset>,
    pub recycle_bin: RecycleBin,
    pub lib_meta: LibraryMeta,
}

impl Storage {
    pub fn from_constructed(settings: StorageConstructionSettings) -> AppResult<Self> {
        let src_root_folder = settings.src_root;
        let root_path = settings.root;

        if root_path.exists() && read_dir(&root_path)?.count() != 0 {
            return Err(AppError::FolderNotEmpty(root_path.to_path_buf()));
        }

        validate_library(&root_path, true);

        let root_collection = Collection::new(None, None, Default::default());
        let sp_collections = SpecialCollections {
            root: root_collection.id,
        };

        let mut assets = HashMap::default();
        let mut duplication = HashMap::default();
        let mut tags = HashMap::default();
        let mut collections = HashMap::from([(root_collection.id, root_collection.clone())]);
        let mut folder_tags = HashMap::default();
        let mut folder_collections = HashMap::from([(src_root_folder.clone(), root_collection.id)]);

        collect_path(
            &root_path,
            src_root_folder.to_path_buf(),
            &mut assets,
            &mut duplication,
            &mut settings.folder_as_tag.then_some(FolderAsTag {
                root_collection: root_collection.id,
                tags: &mut tags,
                collections: &mut collections,
                folder_tags: &mut folder_tags,
                folder_collections: &mut folder_collections,
            }),
        )?;

        let mut result = Self {
            cache: Default::default(),
            sp_collections,
            tags,
            collections,
            assets,
            recycle_bin: Default::default(),
            lib_meta: LibraryMeta::new(
                root_path.file_name().unwrap().to_string_lossy().to_string(),
            ),
        };
        result.cache = StorageCache::build(&root_path, duplication);

        Ok(result)
    }

    pub fn from_existing(root_folder: impl AsRef<Path>) -> Result<Self, AppError> {
        let root = root_folder.as_ref();
        if !validate_library(root, false) {
            return Err(AppError::InvalidLibrary);
        }

        let path = root.join(LIBRARY_STORAGE);
        let reader = File::open(&path)?;
        // TODO fallback to legacy storage if fails.
        let mut result = serde_json::from_reader::<_, Self>(reader)?;

        let asset_crc = result
            .assets
            .values()
            .filter_map(|asset| {
                read(asset.get_file_path(&root))
                    .ok()
                    .map(|data| (data, asset.id))
            })
            .map(|(data, id)| (id, crc32fast::hash(&data)))
            .collect();

        // // Backward compatibility 0.1.0
        // if result.root_collection == CollectionId::default() {
        //     let root_collection = Collection::new(None, Default::default());
        //     let collections = HashMap::from([(root_collection.id, root_collection.clone())]);
        //     result.root_collection = root_collection.id;
        //     result.collections = collections;
        // }

        result.cache = StorageCache::build(root, asset_crc);
        Ok(result)
    }

    pub fn save(&mut self) -> Result<(), std::io::Error> {
        self.lib_meta.meta.last_modified = Local::now().into();

        Ok(File::create(self.cache.root.join(LIBRARY_STORAGE))?
            .write_all(serde_json::to_string(self)?.as_bytes())?)
    }

    pub fn add_assets(
        &mut self,
        initial_tag: Option<TagId>,
        path: Vec<PathBuf>,
    ) -> AppResult<DuplicateAssets> {
        let mut asset_crc = HashMap::default();
        let mut assets = HashMap::default();

        for path in path {
            collect_path(
                &self.cache.root.clone(),
                path,
                &mut assets,
                &mut asset_crc,
                &mut None,
            )?;
        }

        if let Some(initial_tag) = initial_tag.and_then(|i| self.tags.get(&i)) {
            for asset in assets.values_mut() {
                asset.tags.insert_unchecked(initial_tag);
            }
        }

        self.cache.asset_crc.extend(asset_crc.clone());
        self.assets.extend(assets);
        let duplication = self
            .cache
            .get_duplications(asset_crc.values().cloned().collect());

        Ok(DuplicateAssets(duplication))
    }

    pub fn add_raw_assets(
        &mut self,
        initial_tag: Option<TagId>,
        data: Vec<RawAsset>,
    ) -> AppResult<DuplicateAssets> {
        let root = self.cache.root.clone();

        let mut added_crc = HashSet::<u32>::default();
        for RawAsset { bytes, ext, src } in data {
            let Some(ty) = AssetType::from_ext(&ext) else {
                continue;
            };
            let id = Uuid::new_v4();
            let path = root.join(ty.storage_folder()).join(if ext.is_empty() {
                id.to_string()
            } else {
                format!("{}.{}", id, ext)
            });

            let crc = crc32fast::hash(&bytes);
            added_crc.insert(crc);
            self.cache.add_asset(crc, AssetId(id));

            let mut file = File::create(&path)?;
            file.write(&bytes)?;
            file.flush()?;

            let meta = Metadata::from_std_meta(&file.metadata()?);
            let props = match ty {
                AssetType::RasterGraphics => {
                    let size = imagesize::blob_size(&bytes)?;
                    AssetProperty::RasterGraphics(RasterGraphicsProperty::new(size))
                }
                AssetType::VectorGraphics => {
                    if let Some(props) = VectorGraphicsProperty::new(bytes) {
                        AssetProperty::VectorGraphics(props)
                    } else {
                        continue;
                    }
                }
                AssetType::GltfModel => {
                    if let Some(props) = GltfModelProperty::new(&bytes) {
                        AssetProperty::GltfModel(props)
                    } else {
                        continue;
                    }
                }
            };

            let mut asset = Asset {
                id: AssetId(id),
                ..Asset::new(id.to_string(), ext.into(), meta, ty, props, src)
            };

            if let Some(initial_tag) = initial_tag.and_then(|i| self.tags.get(&i)) {
                asset.tags.insert_unchecked(initial_tag);
            }

            self.assets.insert(asset.id, asset);
        }

        Ok(DuplicateAssets(
            self.cache.get_duplications(added_crc.into_iter().collect()),
        ))
    }

    pub fn move_asset_to_recycle_bin(&mut self, id: AssetId) -> AppResult<()> {
        if let Some(asset) = self.assets.get_mut(&id) {
            asset.is_deleted = true;
            self.cache.remove_asset(asset.id);
            self.recycle_bin.assets.insert(id);

            Ok(())
        } else {
            Err(AppError::AssetNotFound(id))
        }
    }

    pub fn delete_asset(&mut self, id: AssetId) -> AppResult<()> {
        if let Some(asset) = self.assets.remove(&id) {
            self.cache.remove_asset(asset.id);
            remove_file(asset.get_file_path(&self.cache.root))?;

            Ok(())
        } else {
            Err(AppError::AssetNotFound(id))
        }
    }

    pub fn delete_tag(&mut self, id: TagId) -> AppResult<()> {
        let Some(tag) = self.tags.remove(&id) else {
            return Err(AppError::TagNotFound(id));
        };

        if let Some(parent) = self.collections.get_mut(&tag.parent) {
            parent.content.remove(&id);
        }

        Ok(())
    }

    pub fn delete_collection(&mut self, id: CollectionId) -> AppResult<()> {
        if self.sp_collections.is_special(id) {
            return Err(AppError::IllegalCollectionModification(id));
        }

        let Some(collection) = self.collections.remove(&id) else {
            return Err(AppError::CollectionNotFound(id));
        };

        for tag in collection.content.clone() {
            self.delete_tag(tag)?;
        }

        for child in collection.children {
            self.delete_collection(child)?;
        }

        if let Some(parent) = collection.parent.and_then(|p| self.collections.get_mut(&p)) {
            parent.children.remove(&id);
        }

        Ok(())
    }

    pub fn recover_assets(&mut self, assets: Vec<AssetId>) -> AppResult<DuplicateAssets> {
        for asset in assets {
            let Some(asset) = self.assets.get_mut(&asset) else {
                continue;
            };
            asset.is_deleted = false;
            self.cache
                .add_asset(asset.compute_crc(&self.cache.root)?, asset.id);

            self.recycle_bin.assets.remove(&asset.id);
        }

        Ok(DuplicateAssets::default())
    }

    pub fn create_tag(&mut self, name: String, parent: CollectionId) -> AppResult<()> {
        let tag = Tag::new(name, parent);
        let Some(parent) = self.collections.get_mut(&parent) else {
            return Err(AppError::CollectionNotFound(parent));
        };
        parent.content.insert(tag.id);
        self.tags.insert(tag.id, tag);
        Ok(())
    }

    pub fn create_collection(&mut self, name: String, parent: CollectionId) -> AppResult<()> {
        let collection = Collection::new(Some(parent), None, name);
        let Some(parent) = self.collections.get_mut(&parent) else {
            return Err(AppError::CollectionNotFound(parent));
        };
        parent.children.insert(collection.id);
        self.collections.insert(collection.id, collection);
        Ok(())
    }

    pub fn rename_asset(&mut self, id: AssetId, new_name: String) -> AppResult<()> {
        if let Some(asset) = self.assets.get_mut(&id) {
            asset.name = new_name;

            Ok(())
        } else {
            Err(AppError::AssetNotFound(id))
        }
    }

    pub fn rename_collection(&mut self, id: CollectionId, new_name: String) -> AppResult<()> {
        if let Some(collection) = self.collections.get_mut(&id) {
            collection.name = new_name;
            Ok(())
        } else {
            Err(AppError::CollectionNotFound(id))
        }
    }

    pub fn rename_tag(&mut self, id: TagId, new_name: String) -> AppResult<()> {
        if let Some(tag) = self.tags.get_mut(&id) {
            tag.name = new_name;
            Ok(())
        } else {
            Err(AppError::TagNotFound(id))
        }
    }

    pub fn recolor_collection(
        &mut self,
        collection: CollectionId,
        new_color: Option<Color>,
    ) -> AppResult<()> {
        if self.sp_collections.is_special(collection) {
            return Err(AppError::IllegalCollectionModification(collection));
        }

        let Some(collection) = self.collections.get_mut(&collection) else {
            return Err(AppError::CollectionNotFound(collection));
        };

        collection.color = new_color;
        for tag in self.tags.values_mut() {
            if tag.group.is_some_and(|g| g == collection.id) {
                tag.color = new_color;
            }
        }
        Ok(())
    }

    pub fn move_collection_to(
        &mut self,
        src_id: CollectionId,
        dst_id: CollectionId,
    ) -> AppResult<()> {
        if self.sp_collections.is_special(src_id) || src_id == dst_id {
            return Err(AppError::IllegalCollectionModification(src_id));
        }

        let Some(src_collection) = self.collections.get(&src_id).cloned() else {
            return Err(AppError::CollectionNotFound(src_id));
        };

        if let Some(parent) = src_collection.parent {
            let Some(parent) = self.collections.get_mut(&parent) else {
                return Err(AppError::CollectionNotFound(parent));
            };
            parent.children.remove(&src_id);
        }

        let Some(new_parent) = self.collections.get_mut(&dst_id) else {
            return Err(AppError::CollectionNotFound(dst_id));
        };

        new_parent.children.insert(src_id);
        self.collections.get_mut(&src_id).unwrap().parent = Some(dst_id);

        Ok(())
    }

    pub fn move_tag_to(&mut self, src_id: TagId, dst_id: CollectionId) -> AppResult<()> {
        let Some(src_tag) = self.tags.get_mut(&src_id) else {
            return Err(AppError::TagNotFound(src_id));
        };

        if let Some(parent) = self.collections.get_mut(&src_tag.parent) {
            parent.content.remove(&src_id);
        }

        let Some(new_parent) = self.collections.get_mut(&dst_id) else {
            return Err(AppError::CollectionNotFound(dst_id));
        };

        new_parent.content.insert(src_id);
        src_tag.parent = new_parent.id;

        Ok(())
    }

    pub fn regroup_tag(
        &mut self,
        id: TagId,
        group: Option<CollectionId>,
        resolve: TagGroupConflictResolve,
    ) -> AppResult<()> {
        let Some(tag) = self.tags.get_mut(&id) else {
            return Err(AppError::TagNotFound(id));
        };

        let old_group = tag.group;
        tag.group = group;

        if let Some(group) = group {
            if let Some(group) = self.collections.get(&group) {
                tag.color = group.color;
            } else {
                return Err(AppError::CollectionNotFound(group));
            }
        } else {
            tag.color = None;
        }

        for asset in self.assets.values_mut() {
            asset.tags.regroup(old_group, group, tag.id, resolve);
        }

        Ok(())
    }

    pub fn add_tag_to_asset(
        &mut self,
        asset: AssetId,
        tag: TagId,
        resolve: TagGroupConflictResolve,
    ) -> AppResult<()> {
        let Some(asset) = self.assets.get_mut(&asset) else {
            return Err(AppError::AssetNotFound(asset));
        };
        let Some(tag) = self.tags.get(&tag) else {
            return Err(AppError::TagNotFound(tag));
        };

        asset.tags.insert(tag, resolve);
        Ok(())
    }

    pub fn remove_tag_from_asset(&mut self, asset: AssetId, tag: TagId) -> AppResult<()> {
        let Some(asset) = self.assets.get_mut(&asset) else {
            return Err(AppError::AssetNotFound(asset));
        };
        let Some(tag) = self.tags.get(&tag) else {
            return Err(AppError::TagNotFound(tag));
        };

        asset.tags.remove(tag);
        Ok(())
    }

    pub fn get_asset_abs_path(&self, id: AssetId) -> AppResult<PathBuf> {
        self.assets
            .get(&id)
            .map(|a| a.get_file_path(&self.cache.root))
            .ok_or_else(|| AppError::AssetNotFound(id))
    }

    pub fn get_tag_virtual_path(&self, id: TagId) -> AppResult<Vec<String>> {
        let Some(tag) = self.tags.get(&id) else {
            return Err(AppError::TagNotFound(id));
        };

        let mut res = vec![tag.name.clone()];
        let mut cur_id = Some(tag.parent);
        while let Some(id) = cur_id.filter(|i| !self.sp_collections.is_special(*i)) {
            if let Some(collection) = self.collections.get(&id) {
                res.push(collection.name.clone());
                cur_id = collection.parent;
            } else {
                return Err(AppError::CollectionNotFound(id));
            }
        }

        res.reverse();

        Ok(res)
    }

    pub fn gen_statistics(&self) -> LibraryStatistics {
        let mut asset_ext = HashMap::default();

        for asset in self.assets.values() {
            match asset_ext.entry(asset.ext.clone()) {
                Entry::Occupied(mut e) => *e.get_mut() += 1,
                Entry::Vacant(e) => {
                    e.insert(1);
                }
            }
        }

        LibraryStatistics {
            total_assets: self.assets.len() as u32,
            asset_ext,
        }
    }
}

pub struct RawAsset {
    pub bytes: Vec<u8>,
    pub ext: Arc<str>,
    pub src: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Collection {
    pub is_deleted: bool,
    pub parent: Option<CollectionId>,
    pub id: CollectionId,
    pub name: String,
    pub color: Option<Color>,
    pub meta: Metadata,
    pub content: HashSet<TagId>,
    pub children: HashSet<CollectionId>,
}

impl Collection {
    pub fn new(parent: Option<CollectionId>, color: Option<Color>, name: String) -> Self {
        Self {
            is_deleted: false,
            parent,
            id: CollectionId(Uuid::new_v4()),
            name,
            color,
            meta: Metadata::now(0),
            content: Default::default(),
            children: Default::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    // Backward compatibility 0.1.0
    #[serde(default)]
    pub parent: CollectionId,
    pub group: Option<CollectionId>,
    pub id: TagId,
    pub name: String,
    pub color: Option<Color>,
    pub meta: Metadata,
}

impl Tag {
    pub fn new(name: String, parent: CollectionId) -> Self {
        Self {
            parent,
            group: None,
            color: None,
            id: TagId(Uuid::new_v4()),
            name,
            meta: Metadata::now(0),
        }
    }
}

#[derive(Debug, Error)]
pub enum ParseColorError {
    #[error("Invalid length: {0}")]
    LengthError(usize),
    #[error("{0}")]
    ParseIntError(#[from] std::num::ParseIntError),
}

#[derive(Debug, Clone, Copy)]
pub struct Color {
    pub r: u8,
    pub g: u8,
    pub b: u8,
    pub a: u8,
}

impl Color {
    pub fn random() -> Self {
        let mut rng = rand::thread_rng();
        Self {
            r: rng.gen(),
            g: rng.gen(),
            b: rng.gen(),
            a: rng.gen(),
        }
    }

    pub fn into_hex_str(self) -> String {
        format!("{:02x}{:02x}{:02x}{:02x}", self.r, self.g, self.b, self.a)
    }

    pub fn from_hex_str(s: &str) -> Result<Self, ParseColorError> {
        if s.len() != 6 && s.len() != 8 {
            return Err(ParseColorError::LengthError(s.len()));
        }

        let r = u8::from_str_radix(&s[0..2], 16)?;
        let g = u8::from_str_radix(&s[2..4], 16)?;
        let b = u8::from_str_radix(&s[4..6], 16)?;
        let a = if s.len() == 6 {
            255
        } else {
            u8::from_str_radix(&s[6..8], 16)?
        };

        Ok(Self { r, g, b, a })
    }
}

impl Serialize for Color {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&self.into_hex_str())
    }
}

impl<'de> Deserialize<'de> for Color {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: serde::Deserializer<'de>,
    {
        struct ColorVisitor;
        impl<'de> serde::de::Visitor<'de> for ColorVisitor {
            type Value = Color;

            fn expecting(&self, formatter: &mut std::fmt::Formatter) -> std::fmt::Result {
                formatter.write_str("color hex value without leading #")
            }

            fn visit_str<E>(self, v: &str) -> Result<Self::Value, E>
            where
                E: serde::de::Error,
            {
                Color::from_hex_str(v).map_err(|e| serde::de::Error::custom(e))
            }
        }

        deserializer.deserialize_string(ColorVisitor)
    }
}

#[derive(Serialize, Deserialize, Default, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TagContainer {
    pub grouped: HashMap<CollectionId, TagId>,
    pub ungrouped: HashSet<TagId>,
}

impl TagContainer {
    pub fn insert_unchecked(&mut self, tag: &Tag) {
        match tag.group {
            Some(group) => {
                self.grouped.insert(group, tag.id);
            }
            None => {
                self.ungrouped.insert(tag.id);
            }
        }
    }

    pub fn insert(&mut self, tag: &Tag, resolve: TagGroupConflictResolve) {
        match tag.group {
            Some(group) => match self.grouped.entry(group) {
                Entry::Occupied(mut e) => match resolve {
                    TagGroupConflictResolve::Override => {
                        e.insert(tag.id);
                    }
                    TagGroupConflictResolve::Remove => {}
                },
                Entry::Vacant(e) => {
                    e.insert(tag.id);
                }
            },
            None => {
                self.ungrouped.insert(tag.id);
            }
        }
    }

    pub fn remove(&mut self, tag: &Tag) {
        match tag.group {
            Some(group) => {
                self.grouped.remove(&group);
            }
            None => {
                self.ungrouped.remove(&tag.id);
            }
        }
    }

    pub fn contains_id(&self, id: TagId) -> bool {
        self.ungrouped.contains(&id) || self.grouped.values().find(|t| t == &&id).is_some()
    }

    #[allow(unused)]
    pub fn contains(&self, tag: Tag) -> bool {
        match tag.group {
            Some(group) => self.grouped.contains_key(&group),
            None => self.ungrouped.contains(&tag.id),
        }
    }

    pub fn regroup(
        &mut self,
        old_group: Option<CollectionId>,
        new_group: Option<CollectionId>,
        id: TagId,
        resolve: TagGroupConflictResolve,
    ) {
        if let Some(old_group) = old_group {
            if self.grouped.remove(&old_group).is_none() {
                return;
            }
        } else if !self.ungrouped.remove(&id) {
            return;
        }

        if let Some(new_group) = new_group {
            match self.grouped.entry(new_group) {
                Entry::Occupied(mut e) => match resolve {
                    TagGroupConflictResolve::Override => *e.get_mut() = id,
                    TagGroupConflictResolve::Remove => {}
                },
                Entry::Vacant(e) => {
                    e.insert(id);
                }
            }
        } else {
            self.ungrouped.insert(id);
        }
    }

    pub fn is_empty(&self) -> bool {
        self.grouped.is_empty() && self.ungrouped.is_empty()
    }
}

impl Into<Vec<TagId>> for TagContainer {
    fn into(self) -> Vec<TagId> {
        self.grouped
            .into_iter()
            .map(|(_, tag)| tag)
            .chain(self.ungrouped)
            .collect()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub is_deleted: bool,
    pub id: AssetId,
    pub name: String,
    pub ty: AssetType,
    pub ext: Arc<str>,
    pub props: AssetProperty,
    pub meta: Metadata,
    pub tags: TagContainer,
    pub src: String,
}

impl Asset {
    pub fn new(
        name: String,
        ext: Arc<str>,
        meta: Metadata,
        ty: AssetType,
        props: AssetProperty,
        src: String,
    ) -> Self {
        Self {
            is_deleted: false,
            id: AssetId(Uuid::new_v4()),
            ty,
            name,
            ext,
            props,
            meta,
            tags: Default::default(),
            src,
        }
    }

    pub fn gen_file_name(&self) -> String {
        if self.ext.is_empty() {
            self.name.to_owned()
        } else {
            format!("{}.{}", self.name, self.ext)
        }
    }

    pub fn get_file_name(&self) -> String {
        if self.ext.is_empty() {
            self.id.clone().0.to_string()
        } else {
            format!("{}.{}", self.id.0, self.ext)
        }
    }

    pub fn get_file_path(&self, root: &Path) -> PathBuf {
        root.join(self.ty.storage_folder())
            .join(self.get_file_name())
    }

    pub fn compute_crc(&self, root: &Path) -> std::io::Result<u32> {
        Ok(crc32fast::hash(&read(
            root.join(self.ty.storage_folder())
                .join(self.get_file_name()),
        )?))
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum AssetProperty {
    RasterGraphics(RasterGraphicsProperty),
    VectorGraphics(VectorGraphicsProperty),
    GltfModel(GltfModelProperty),
}

impl AssetProperty {
    const QUICK_REF_MAX_PORTION: f32 = 0.3;

    pub fn get_quick_ref_size(&self, screen: [u32; 2]) -> [u32; 2] {
        match self {
            AssetProperty::RasterGraphics(prop) => {
                let aspect = prop.width as f32 / prop.height as f32;
                if prop.width > prop.height {
                    let width = prop
                        .width
                        .min((screen[0] as f32 * Self::QUICK_REF_MAX_PORTION) as u32);
                    [width, (width as f32 / aspect) as u32]
                } else {
                    let height = prop
                        .height
                        .min((screen[1] as f32 * Self::QUICK_REF_MAX_PORTION) as u32);
                    [(height as f32 * aspect) as u32, height]
                }
            }
            AssetProperty::VectorGraphics(prop) => {
                let width = screen[0] as f32 * Self::QUICK_REF_MAX_PORTION;
                let height = width * prop.aspect;
                [width as u32, height as u32]
            }
            AssetProperty::GltfModel(_) => [
                (screen[0] as f32 * Self::QUICK_REF_MAX_PORTION) as u32,
                (screen[1] as f32 * Self::QUICK_REF_MAX_PORTION) as u32,
            ],
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RasterGraphicsProperty {
    pub width: u32,
    pub height: u32,
}

impl RasterGraphicsProperty {
    pub fn new(size: imagesize::ImageSize) -> Self {
        Self {
            width: size.width as u32,
            height: size.height as u32,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct VectorGraphicsProperty {
    pub width: u32,
    pub height: u32,
    pub aspect: f32,
}

impl VectorGraphicsProperty {
    pub fn new(content: Vec<u8>) -> Option<Self> {
        let content = String::from_utf8(content).ok()?;
        let mut parser = svg::read(&content).ok()?;
        let size = parser.find_map(|ev| match ev {
            svg::parser::Event::Tag(_, _, hash_map) => hash_map.get("viewBox").cloned(),
            _ => None,
        })?;

        let borders = size
            .split(' ')
            .filter_map(|val| val.parse().ok())
            .collect::<Vec<u32>>();
        if borders.len() != 4 {
            return None;
        }

        let width = borders[2] - borders[0];
        let height = borders[3] - borders[1];

        Some(Self {
            width,
            height,
            aspect: width as f32 / height as f32,
        })
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GltfModelProperty {
    pub min: [f32; 3],
    pub max: [f32; 3],
    pub size: [f32; 3],
    pub triangles: u32,
    pub vertices: u32,
    pub cache_camera: Option<GltfPreviewCamera>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GltfPreviewCamera {
    pub pos: [f32; 3],
    pub rot: [f32; 4],
}

impl GltfModelProperty {
    pub fn new(content: &[u8]) -> Option<Self> {
        let model = Gltf::from_slice(content).ok()?;

        let mut min = [f32::MAX, f32::MAX, f32::MAX];
        let mut max = [f32::MIN, f32::MIN, f32::MIN];
        let mut triangles = 0;
        let mut vertex_buffers = Vec::new();

        for mesh in model.meshes() {
            for primitive in mesh.primitives() {
                let bounding = primitive.bounding_box();

                min[0] = min[0].min(bounding.min[0]);
                min[1] = min[1].min(bounding.min[1]);
                min[2] = min[2].min(bounding.min[2]);

                max[0] = max[0].max(bounding.max[0]);
                max[1] = max[1].max(bounding.max[1]);
                max[2] = max[2].max(bounding.max[2]);

                triangles += primitive.indices()?.count() / 3;

                let (_, acc) = primitive
                    .attributes()
                    .find(|(sem, _)| *sem == gltf::Semantic::Positions)?;
                let view = acc.view()?;
                vertex_buffers.push(view.offset()..view.length());
            }
        }

        vertex_buffers.sort_by_key(|r| r.start);
        let mut merged = vec![vertex_buffers[0].clone()];
        for idx in 1..vertex_buffers.len() {
            if vertex_buffers[idx].start <= vertex_buffers[idx - 1].end {
                let last = merged.last_mut().unwrap();
                last.end = vertex_buffers[idx].end;
            } else {
                merged.push(vertex_buffers[idx].clone());
            }
        }

        let vertices = merged
            .into_iter()
            .fold(0, |acc, range| acc + range.len() / size_of::<[f32; 3]>());

        Some(Self {
            max,
            min,
            triangles: triangles as u32,
            vertices: vertices as u32,
            size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]],
            cache_camera: None,
        })
    }

    // TODO validate if the computation is correct
    pub fn compute_camera_pos(
        &self,
        y_fov: f32,
        view_dir: [f32; 3],
        aspect_ratio: f32,
    ) -> [f32; 3] {
        let world_min = Vec3::from(self.min) * 1.1;
        let world_max = Vec3::from(self.max) * 1.1;
        let verts_world = [
            Vec3::new(world_min.x, world_min.y, world_min.z),
            Vec3::new(world_max.x, world_min.y, world_min.z),
            Vec3::new(world_min.x, world_max.y, world_min.z),
            Vec3::new(world_max.x, world_max.y, world_min.z),
            Vec3::new(world_min.x, world_min.y, world_max.z),
            Vec3::new(world_max.x, world_min.y, world_max.z),
            Vec3::new(world_min.x, world_max.y, world_max.z),
            Vec3::new(world_max.x, world_max.y, world_max.z),
        ];

        let view_mat = Mat4::look_to_lh(Vec3::ZERO, view_dir.into(), Vec3::Y);
        let mut verts_view = verts_world;
        for v in &mut verts_view {
            *v = (view_mat * v.extend(1.0)).truncate();
        }
        let (view_min, view_max) = verts_view
            .into_iter()
            .fold((Vec3::MAX, Vec3::MIN), |(min, max), v| {
                (v.min(min), v.max(max))
            });
        let view_coverage = view_max.abs().max(view_min.abs());
        let view_half_coverage = view_coverage * 0.5;

        let tan_half_y_fov = (y_fov * 0.5).tan();
        let tan_half_x_fov = (0.5 * aspect_ratio) / (0.5 / aspect_ratio / tan_half_y_fov);
        let depth = (view_half_coverage.x / tan_half_x_fov)
            .max(view_half_coverage.x / tan_half_y_fov)
            .max(view_half_coverage.y / tan_half_x_fov)
            .max(view_half_coverage.y / tan_half_y_fov);

        (view_mat.inverse() * (Vec3::Z * depth).extend(1.0))
            .truncate()
            .into()
    }
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub enum AssetType {
    RasterGraphics,
    VectorGraphics,
    GltfModel,
}

impl AssetType {
    pub fn from_ext(ext: &str) -> Option<Self> {
        match ext {
            // https://developer.mozilla.org/en-US/docs/Web/Media/Formats/Image_types
            "apng" | "png" | "avif" | "gif" | "jpg" | "jpeg" | "jfif" | "pjpeg" | "pjp"
            | "webp" | "bmp" | "ico" | "cur" | "tif" | "tiff" => Some(Self::RasterGraphics),
            "svg" => Some(Self::VectorGraphics),
            "glb" => Some(Self::GltfModel),
            _ => None,
        }
    }

    pub fn storage_folder(self) -> &'static str {
        match self {
            AssetType::RasterGraphics | AssetType::VectorGraphics => IMAGE_ASSETS,
            AssetType::GltfModel => MODEL_ASSETS,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Metadata {
    pub byte_size: u64,
    pub created_at: Option<DateTime<FixedOffset>>,
    pub last_modified: DateTime<FixedOffset>,
}

impl Metadata {
    pub fn from_std_meta(meta: &std::fs::Metadata) -> Self {
        Self {
            byte_size: meta.len(),
            created_at: FileTime::from_creation_time(&meta).map(|t| {
                DateTime::from_timestamp(t.unix_seconds() as i64, 0)
                    .unwrap()
                    .into()
            }),
            last_modified: DateTime::from_timestamp(
                FileTime::from_last_modification_time(&meta).unix_seconds(),
                0,
            )
            .unwrap()
            .into(),
        }
    }

    pub fn now(byte_size: u64) -> Self {
        Self {
            byte_size,
            created_at: Some(Local::now().into()),
            last_modified: Local::now().into(),
        }
    }
}

fn validate_library(root_folder: impl AsRef<Path>, create_structure: bool) -> bool {
    let root = root_folder.as_ref();
    if root.join(LIBRARY_STORAGE).exists() || create_structure {
        let _ = create_dir_all(root.join(IMAGE_ASSETS));
        let _ = create_dir_all(root.join(MODEL_ASSETS));
        let _ = create_dir_all(root.join(CACHE));

        true
    } else {
        false
    }
}
