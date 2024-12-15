use std::{
    fs::{copy, create_dir_all, metadata, read, read_dir, remove_file, File},
    io::Write,
    ops::{Deref, DerefMut},
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::{DateTime, FixedOffset, Local};
use filetime::FileTime;
use hashbrown::{hash_map::Entry, HashMap, HashSet};
use infer::MatcherType;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use thiserror::Error;
use uuid::Uuid;

pub const LIBRARY_STORAGE: &str = "snowflake.json";
pub const IMAGE_ASSETS: &str = "images";
pub const DATA: &str = "app_meta.json";
pub const SETTINGS: &str = "resources/settings_default.json";

#[derive(Debug, Error)]
pub enum AppError {
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
    #[error("Folder {0:?} not found.")]
    FolderNotFound(FolderId),
    #[error("Folder at {0} is not empty.")]
    FolderNotEmpty(PathBuf),
    #[error("Unknown file type.")]
    UnknownFileType,
    #[error("Illegal folder deletion: {0:?}")]
    IllegalFolderDeletion(FolderId),
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
}

impl SettingsDefault {
    pub fn default_value(self) -> SettingsValue {
        match self {
            SettingsDefault::Selection { default, .. } => SettingsValue::Name(default),
            SettingsDefault::Sequence(vec) => SettingsValue::Sequence(vec),
            SettingsDefault::Toggle(enabled) => SettingsValue::Toggle(enabled),
        }
    }
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(untagged)]
pub enum SettingsValue {
    Name(String),
    Toggle(bool),
    Sequence(Vec<String>),
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
        let cache_dir = app.path().app_cache_dir()?;
        let dir = cache_dir.join(DATA);

        #[cfg(debug_assertions)]
        let debug = true;
        #[cfg(not(debug_assertions))]
        let debug = false;

        let mut data = if !dir.exists() || debug {
            Self::default()
        } else {
            let mut data = match serde_json::from_reader(File::open(dir)?) {
                Ok(ok) => ok,
                Err(_) => {
                    log::info!("Failed to parse app data, recreating one.");
                    let data = Self::default();
                    data.save(app)?;
                    data
                }
            };

            data.recent_libs = data
                .recent_libs
                .into_iter()
                .filter(|(p, _)| check_library_structure_validity(p))
                .collect();

            data
        };

        data.settings
            .fill_if_none(app.state::<ResourceCache>().inner());
        data.save(app)?;
        Ok(data)
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), AppError> {
        let cache_dir = app.path().app_cache_dir()?;
        let dir = cache_dir.join(DATA);
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

fn collect_path(
    root: &Path,
    path: PathBuf,
    parent: Option<FolderId>,
    folders: &mut HashMap<FolderId, Folder>,
    assets: &mut HashMap<AssetId, Asset>,
    asset_crc: &mut HashMap<AssetId, u32>,
) -> AppResult<Option<FolderId>> {
    let std_meta = metadata(&path)?;
    let meta = Metadata::from_std_meta(&std_meta);
    let name = path
        .file_stem()
        .unwrap_or_default()
        .to_string_lossy()
        .to_string();

    if path.is_dir() {
        let folder = Folder::new(parent, name, meta);
        let folder_id = folder.id;

        if let Some(parent) = parent.and_then(|p| folders.get_mut(&p)) {
            parent.children.insert(folder_id);
        }

        folders.insert(folder_id, folder);

        for entry in read_dir(path)? {
            collect_path(
                root,
                entry?.path(),
                Some(folder_id),
                folders,
                assets,
                asset_crc,
            )?;
        }

        Ok(Some(folder_id))
    } else if path.is_file() {
        let file_ty = infer::get_from_path(&path)?.ok_or_else(|| AppError::UnknownFileType)?;
        if file_ty.matcher_type() != MatcherType::Image {
            return Ok(None);
        }

        let parent = folders.get_mut(&parent.unwrap()).unwrap();
        let ext = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let file_content = read(&path)?;
        let crc = crc32fast::hash(&file_content);

        let Some(ty) = infer::get(&file_content)
            .map(|t| t.matcher_type())
            .and_then(|m| AssetType::from_matcher(m))
        else {
            return Ok(None);
        };

        let props = match ty {
            AssetType::Image => {
                let size = imagesize::size(&path)?;
                AssetProperty::Image(ImageProperty {
                    width: size.width as u32,
                    height: size.height as u32,
                })
            }
        };

        let asset = Asset::new(
            parent.id,
            name,
            ext.into(),
            meta,
            ty,
            props,
            Default::default(),
        );

        // Copy to preserve metadata
        copy(
            &path,
            root.join(IMAGE_ASSETS).join(asset.get_file_name_id()),
        )?;
        asset_crc.insert(asset.id, crc);
        parent.content.insert(asset.id);
        assets.insert(asset.id, asset);

        Ok(None)
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

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
#[serde(rename_all = "camelCase")]
pub enum ItemId {
    Asset(Uuid),
    Folder(Uuid),
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum Item {
    Asset(Asset),
    Folder(Folder),
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

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Storage {
    #[serde(skip)]
    pub cache: StorageCache,
    pub root_id: FolderId,
    pub tags: HashMap<TagId, Tag>,
    pub folders: HashMap<FolderId, Folder>,
    pub assets: HashMap<AssetId, Asset>,
    // Backward compatibility 0.0.1
    #[serde(default)]
    pub recycle_bin: HashSet<ItemId>,
    // Backward compatibility 0.0.1
    #[serde(default)]
    pub lib_meta: LibraryMeta,
}

impl Storage {
    pub fn from_constructed(
        src_root_folder: impl AsRef<Path>,
        root_folder: impl AsRef<Path>,
    ) -> AppResult<Self> {
        let src_root_folder = src_root_folder.as_ref();
        let root_path = root_folder.as_ref();

        if root_path.exists() && read_dir(root_path)?.count() != 0 {
            return Err(AppError::FolderNotEmpty(root_path.to_path_buf()));
        }

        let _ = create_dir_all(root_path.join(IMAGE_ASSETS));

        let mut folders = HashMap::default();
        let mut assets = HashMap::default();
        let mut duplication = HashMap::default();

        let root_id = collect_path(
            root_path,
            src_root_folder.to_path_buf(),
            None,
            &mut folders,
            &mut assets,
            &mut duplication,
        )?
        .unwrap();

        let mut result = Self {
            cache: Default::default(),
            root_id,
            tags: Default::default(),
            folders,
            assets,
            recycle_bin: Default::default(),
            lib_meta: LibraryMeta::new(
                root_path.file_name().unwrap().to_string_lossy().to_string(),
            ),
        };
        result.cache = StorageCache::build(root_path, duplication);

        Ok(result)
    }

    pub fn from_existing(root_folder: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let root = root_folder.as_ref();
        let path = root.join(LIBRARY_STORAGE);
        let reader = File::open(&path)?;
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
        path: Vec<PathBuf>,
        parent: FolderId,
    ) -> AppResult<DuplicateAssets> {
        if !self.folders.contains_key(&parent) {
            return Err(AppError::FolderNotFound(parent));
        }

        let mut asset_crc = HashMap::default();
        for path in path {
            collect_path(
                &self.cache.root.clone(),
                path,
                Some(parent),
                &mut self.folders,
                &mut self.assets,
                &mut asset_crc,
            )?;
        }

        self.cache.asset_crc.extend(asset_crc.clone());
        let duplication = self
            .cache
            .get_duplications(asset_crc.values().cloned().collect());

        Ok(DuplicateAssets(duplication))
    }

    pub fn add_raw_assets(
        &mut self,
        data: Vec<RawAsset>,
        parent: FolderId,
    ) -> AppResult<DuplicateAssets> {
        let root = self.cache.root.clone();
        let Some(parent) = self.folders.get_mut(&parent) else {
            return Err(AppError::FolderNotFound(parent).into());
        };

        let mut added_crc = HashSet::<u32>::default();
        for RawAsset {
            bytes,
            ty,
            ext,
            src,
        } in data
        {
            let id = Uuid::new_v4();
            let path = root.join(IMAGE_ASSETS).join(if ext.is_empty() {
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
                AssetType::Image => {
                    let size = imagesize::blob_size(&bytes)?;
                    AssetProperty::Image(ImageProperty {
                        width: size.width as u32,
                        height: size.height as u32,
                    })
                }
            };

            let asset = Asset {
                id: AssetId(id),
                ..Asset::new(parent.id, id.to_string(), ext.into(), meta, ty, props, src)
            };

            parent.content.insert(asset.id);
            self.assets.insert(asset.id, asset);
        }

        Ok(DuplicateAssets(
            self.cache.get_duplications(added_crc.into_iter().collect()),
        ))
    }

    pub fn move_asset_to_recycle_bin(&mut self, id: AssetId) -> AppResult<()> {
        if let Some(asset) = self.assets.get(&id).cloned() {
            if let Some(parent) = self.folders.get_mut(&asset.parent) {
                parent.content.remove(&id);
            }

            self.cache.remove_asset(asset.id);
            self.recycle_bin.insert(ItemId::Asset(id.0));

            Ok(())
        } else {
            Err(AppError::AssetNotFound(id))
        }
    }

    pub fn move_folder_to_recycle_bin(&mut self, id: FolderId) -> AppResult<()> {
        if self.root_id == id {
            return Err(AppError::IllegalFolderDeletion(id));
        }

        if let Some(folder) = self.folders.get(&id).cloned() {
            for asset in folder.content.clone() {
                self.cache.remove_asset(asset);
            }

            if let Some(parent) = folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&id);
            }

            self.recycle_bin.insert(ItemId::Folder(id.0));
        } else {
            return Err(AppError::FolderNotFound(id));
        }

        self.folders.get_mut(&id).unwrap().is_deleted = true;

        Ok(())
    }

    pub fn delete_asset(&mut self, id: AssetId) -> AppResult<()> {
        if let Some(asset) = self.assets.remove(&id) {
            if let Some(parent) = self.folders.get_mut(&asset.parent) {
                parent.content.remove(&id);
            }

            self.cache.remove_asset(asset.id);
            remove_file(asset.get_file_path(&self.cache.root))?;

            Ok(())
        } else {
            Err(AppError::AssetNotFound(id))
        }
    }

    pub fn delete_folder(&mut self, id: FolderId) -> AppResult<()> {
        if self.root_id == id {
            return Err(AppError::IllegalFolderDeletion(id));
        }

        if let Some(folder) = self.folders.remove(&id) {
            for asset in folder.content.clone() {
                self.cache.remove_asset(asset);
                self.delete_asset(asset)?;
            }

            for child in folder.children {
                self.delete_folder(child)?;
            }

            if let Some(parent) = folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&id);
            }

            Ok(())
        } else {
            Err(AppError::FolderNotFound(id))
        }
    }

    pub fn recover_items(
        &mut self,
        items: Vec<ItemId>,
        recover_folder_content: bool,
    ) -> AppResult<DuplicateAssets> {
        let mut recover_recursion = Vec::new();
        for id in items {
            match id {
                ItemId::Asset(asset) => {
                    let Some(asset) = self.assets.get(&AssetId(asset)) else {
                        return Err(AppError::AssetNotFound(AssetId(asset)));
                    };

                    if let Some(parent) = self.folders.get_mut(&asset.parent) {
                        parent.content.insert(asset.id);
                    } else if let Some(parent) = self.folders.get_mut(&asset.parent) {
                        recover_recursion.push(ItemId::Folder(asset.parent.0));
                        parent.content.insert(asset.id);
                    }

                    self.cache
                        .add_asset(asset.compute_crc(&self.cache.root)?, asset.id);
                }
                ItemId::Folder(folder) => {
                    let Some(folder) = self.folders.get_mut(&FolderId(folder)) else {
                        return Err(AppError::FolderNotFound(FolderId(folder)));
                    };
                    folder.is_deleted = false;
                    let folder = folder.clone();

                    if let Some(parent) = folder.parent {
                        if let Some(parent) = self.folders.get_mut(&parent) {
                            parent.children.insert(folder.id);
                        } else {
                            recover_recursion.push(ItemId::Folder(parent.0));
                        }
                    }

                    if recover_folder_content {
                        recover_recursion.extend(
                            folder
                                .content
                                .clone()
                                .into_iter()
                                .map(|id| ItemId::Asset(id.0)),
                        );
                    }
                }
            }

            self.recycle_bin.remove(&id);
        }

        if !recover_recursion.is_empty() {
            self.recover_items(recover_recursion, false)?;
        }

        Ok(DuplicateAssets::default())
    }

    pub fn create_folder(&mut self, name: String, parent: FolderId) -> AppResult<()> {
        let folder = Folder::new(Some(parent), name, Metadata::now(0));
        let Some(parent) = self.folders.get_mut(&parent) else {
            return Err(AppError::FolderNotFound(parent));
        };
        parent.children.insert(folder.id);
        self.folders.insert(folder.id, folder);
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

    pub fn rename_folder(&mut self, id: FolderId, new_name: String) -> AppResult<()> {
        if let Some(folder) = self.folders.get_mut(&id) {
            folder.name = new_name;
            Ok(())
        } else {
            Err(AppError::FolderNotFound(id))
        }
    }

    pub fn move_asset_to(&mut self, asset_id: AssetId, folder_id: FolderId) -> AppResult<()> {
        if let Some(asset) = self.assets.get(&asset_id) {
            if let Some(parent) = self.folders.get_mut(&asset.parent) {
                parent.content.remove(&asset_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&folder_id) {
                new_parent.content.insert(asset_id);
                Ok(())
            } else {
                Err(AppError::FolderNotFound(folder_id))
            }
        } else {
            Err(AppError::AssetNotFound(asset_id))
        }
    }

    pub fn move_folder_to(&mut self, src_id: FolderId, dst_id: FolderId) -> AppResult<()> {
        if let Some(src_folder) = self.folders.get(&src_id).cloned() {
            if let Some(parent) = src_folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&src_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&dst_id) {
                new_parent.children.insert(src_id);
                Ok(())
            } else {
                Err(AppError::FolderNotFound(dst_id))
            }
        } else {
            Err(AppError::FolderNotFound(src_id))
        }
    }

    pub fn get_asset_abs_path(&self, id: AssetId) -> AppResult<PathBuf> {
        self.assets
            .get(&id)
            .map(|a| {
                self.cache
                    .root
                    .join(IMAGE_ASSETS)
                    .join(a.get_file_name_id())
            })
            .ok_or_else(|| AppError::AssetNotFound(id))
    }

    pub fn get_asset_virtual_path(&self, id: AssetId) -> AppResult<Vec<String>> {
        if let Some(asset) = self.assets.get(&id) {
            self.get_folder_virtual_path(asset.parent).map(|mut p| {
                p.push(asset.get_file_name_id());
                p
            })
        } else {
            Err(AppError::AssetNotFound(id))
        }
    }

    pub fn get_folder_virtual_path(&self, id: FolderId) -> AppResult<Vec<String>> {
        let mut res = Vec::new();
        let mut cur_id = Some(id);
        while let Some(id) = cur_id {
            if let Some(folder) = self.folders.get(&id) {
                res.push(folder.name.clone());
                cur_id = folder.parent;
            } else {
                return Err(AppError::FolderNotFound(id));
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
    pub ty: AssetType,
    pub ext: Arc<str>,
    pub src: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: TagId,
    pub name: String,
    pub color: Color,
    pub meta: Metadata,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    // Backward compatibility 0.0.1
    #[serde(default)]
    pub is_deleted: bool,
    pub parent: Option<FolderId>,
    pub id: FolderId,
    pub name: String,
    pub children: HashSet<FolderId>,
    pub content: HashSet<AssetId>,
    pub meta: Metadata,
    pub tags: Vec<TagId>,
}

impl Folder {
    pub fn new(parent: Option<FolderId>, name: String, meta: Metadata) -> Self {
        Self {
            is_deleted: false,
            parent,
            id: FolderId(Uuid::new_v4()),
            name,
            children: Default::default(),
            content: Default::default(),
            meta,
            tags: Default::default(),
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub parent: FolderId,
    pub id: AssetId,
    pub name: String,
    pub ty: AssetType,
    pub ext: Arc<str>,
    pub props: AssetProperty,
    pub meta: Metadata,
    pub tags: Vec<TagId>,
    // Backward compatibility 0.0.1
    #[serde(default)]
    pub src: String,
}

impl Asset {
    pub fn new(
        parent: FolderId,
        name: String,
        ext: Arc<str>,
        meta: Metadata,
        ty: AssetType,
        props: AssetProperty,
        src: String,
    ) -> Self {
        Self {
            parent,
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

    pub fn get_file_name(&self) -> String {
        if self.ext.is_empty() {
            self.name.to_owned()
        } else {
            format!("{}.{}", self.name, self.ext)
        }
    }

    pub fn get_file_name_id(&self) -> String {
        if self.ext.is_empty() {
            self.id.clone().0.to_string()
        } else {
            format!("{}.{}", self.id.0, self.ext)
        }
    }

    pub fn get_file_path(&self, root: &Path) -> PathBuf {
        root.join(IMAGE_ASSETS).join(self.get_file_name_id())
    }

    pub fn compute_crc(&self, root: &Path) -> std::io::Result<u32> {
        Ok(crc32fast::hash(&read(
            root.join(IMAGE_ASSETS).join(self.get_file_name_id()),
        )?))
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]
pub enum AssetProperty {
    Image(ImageProperty),
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageProperty {
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub enum AssetType {
    Image,
}

impl AssetType {
    pub fn from_matcher(matcher: MatcherType) -> Option<Self> {
        match matcher {
            MatcherType::Image => Some(Self::Image),
            _ => None,
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

fn check_library_structure_validity(root_folder: impl AsRef<Path>) -> bool {
    let root = root_folder.as_ref();
    root.join(LIBRARY_STORAGE).exists() && root.join(IMAGE_ASSETS).exists()
}
