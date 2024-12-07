use std::{
    fs::{copy, create_dir_all, metadata, read_dir, File},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::{DateTime, FixedOffset, Local};
use filetime::FileTime;
use hashbrown::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use thiserror::Error;
use uuid::Uuid;

pub const LIBRARY_STORAGE: &str = "snowflake.json";
pub const TEMP_RECYCLE_BIN: &str = "recycle_bin";
pub const IMAGE_ASSETS: &str = "images";
pub const DATA: &str = "app_meta.json";

#[derive(Debug, Error)]
pub enum AppDataError {
    #[error("Io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Tauri error: {0}")]
    Tauri(#[from] tauri::Error),
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub recent_libs: HashMap<PathBuf, RecentLib>,
}

impl AppData {
    pub fn read(app: AppHandle) -> Result<Self, AppDataError> {
        let cache_dir = app.path().app_cache_dir()?;
        let dir = cache_dir.join(DATA);
        if !dir.exists() {
            let data = Self::default();
            data.save(app)?;
            Ok(data)
        } else {
            let mut data = serde_json::from_reader::<_, AppData>(std::fs::File::open(dir)?)?;
            data.recent_libs = data
                .recent_libs
                .into_iter()
                .filter(|(p, _)| check_library_structure_validity(p))
                .collect();
            Ok(data)
        }
    }

    pub fn save(&self, app: AppHandle) -> Result<(), AppDataError> {
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

#[derive(Error, Debug)]
pub enum FileError {
    #[error("Io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Image error: {0}")]
    Image(#[from] imagesize::ImageError),
}

fn collect_path(
    root: &Path,
    path: PathBuf,
    parent: Option<FolderId>,
    folders: &mut HashMap<FolderId, Folder>,
    assets: &mut HashMap<AssetId, Asset>,
) -> Result<Option<FolderId>, FileError> {
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
            collect_path(root, entry?.path(), Some(folder_id), folders, assets)?;
        }

        Ok(Some(folder_id))
    } else if path.is_file() {
        let parent = folders.get_mut(&parent.unwrap()).unwrap();
        let ext = path
            .extension()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let ty = AssetType::from_extension(path.extension());
        let props = match ty {
            AssetType::Image => {
                let size = imagesize::size(&path)?;
                Some(AssetProperty::Image(ImageProperty {
                    width: size.width as u32,
                    height: size.height as u32,
                }))
            }
            AssetType::Unknown => None,
        };

        let asset = Asset::new(parent.id, name, ext.into(), meta, ty, props);

        copy(&path, root.join(IMAGE_ASSETS).join(asset.get_file_name()))?;
        parent.content.insert(asset.id);
        assets.insert(asset.id, asset);

        Ok(None)
    } else {
        unreachable!()
    }
}

#[derive(Debug, Error)]
pub enum StorageModificationError {
    #[error("Asset {0:?} not found.")]
    AssetNotFount(AssetId),
    #[error("Folder {0:?} not found.")]
    FolderNotFount(FolderId),
    #[error("File error: {0}")]
    File(#[from] FileError),
}

#[derive(Debug, Error)]
pub enum StorageCreationError {
    #[error("Folder at {0} is not empty.")]
    FolderNotEmpty(PathBuf),
    #[error("File error: {0}")]
    File(#[from] FileError),
}

pub type StorageModificationResult<T> = Result<T, StorageModificationError>;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FolderId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AssetId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TagId(pub Uuid);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Storage {
    #[serde(skip)]
    pub root: PathBuf,
    pub root_id: FolderId,
    pub tags: HashMap<TagId, Tag>,
    pub folders: HashMap<FolderId, Folder>,
    pub assets: HashMap<AssetId, Asset>,
}

impl Storage {
    pub fn from_constructed(
        src_root_folder: impl AsRef<Path>,
        root_folder: impl AsRef<Path>,
    ) -> Result<Self, StorageCreationError> {
        let src_root_folder = src_root_folder.as_ref();
        let root_path = root_folder.as_ref();

        if root_path.exists() && read_dir(root_path).map_err(|e| FileError::Io(e))?.count() != 0 {
            return Err(StorageCreationError::FolderNotEmpty(
                root_path.to_path_buf(),
            ));
        }

        let _ = create_dir_all(root_path.join(IMAGE_ASSETS));
        let _ = create_dir_all(root_path.join(TEMP_RECYCLE_BIN));

        let mut folders = HashMap::default();
        let mut assets = HashMap::default();

        let root_id = collect_path(
            root_path,
            src_root_folder.to_path_buf(),
            None,
            &mut folders,
            &mut assets,
        )?
        .unwrap();

        Ok(Self {
            root: root_path.to_path_buf(),
            root_id,
            tags: Default::default(),
            folders,
            assets,
        })
    }

    pub fn from_existing(root_folder: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let root = root_folder.as_ref();
        let path = root.join(LIBRARY_STORAGE);
        let reader = std::fs::File::open(&path)?;
        let mut result = serde_json::from_reader::<_, Self>(reader)?;
        result.root = root.to_path_buf();
        Ok(result)
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        Ok(std::fs::File::create(self.root.join(LIBRARY_STORAGE))?
            .write_all(serde_json::to_string(self)?.as_bytes())?)
    }

    pub fn add_assets(
        &mut self,
        path: Vec<PathBuf>,
        parent: FolderId,
    ) -> StorageModificationResult<()> {
        if !self.folders.contains_key(&parent) {
            return Err(StorageModificationError::FolderNotFount(parent));
        }

        for path in path {
            collect_path(
                &self.root,
                path,
                Some(parent),
                &mut self.folders,
                &mut self.assets,
            )?;
        }

        Ok(())
    }

    pub fn add_raw_assets(
        &mut self,
        data: Vec<RawAsset>,
        parent: FolderId,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let Some(parent) = self.folders.get_mut(&parent) else {
            return Err(StorageModificationError::FolderNotFount(parent).into());
        };

        for RawAsset { bytes, ext } in data {
            let id = Uuid::new_v4();
            let path = self.root.join(IMAGE_ASSETS).join(if ext.is_empty() {
                id.to_string()
            } else {
                format!("{}.{}", id, ext)
            });

            let mut file = File::create(&path)?;
            file.write(&bytes)?;
            file.flush()?;

            let ty = AssetType::from_ext_str(&ext);
            let meta = Metadata::from_std_meta(&file.metadata()?);
            let props = match ty {
                AssetType::Image => {
                    let size = imagesize::blob_size(&bytes)?;
                    Some(AssetProperty::Image(ImageProperty {
                        width: size.width as u32,
                        height: size.height as u32,
                    }))
                }
                AssetType::Unknown => None,
            };

            let asset = Asset {
                id: AssetId(id),
                ..Asset::new(parent.id, id.to_string(), ext.into(), meta, ty, props)
            };

            parent.content.insert(asset.id);
            self.assets.insert(asset.id, asset);
        }

        Ok(())
    }

    pub fn delete_asset(&mut self, id: AssetId) -> StorageModificationResult<()> {
        if let Some(asset) = self.assets.remove(&id) {
            if let Some(parent) = self.folders.get_mut(&asset.parent) {
                parent.content.remove(&id);
            }

            let file_name = asset.get_file_name();
            let _ = std::fs::rename(
                self.root.join(IMAGE_ASSETS).join(&file_name),
                self.root.join(TEMP_RECYCLE_BIN).join(file_name),
            );

            Ok(())
        } else {
            Err(StorageModificationError::AssetNotFount(id))
        }
    }

    pub fn delete_folder(&mut self, id: FolderId) -> StorageModificationResult<()> {
        if let Some(folder) = self.folders.remove(&id) {
            if let Some(parent) = folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&id);
            }
            Ok(())
        } else {
            Err(StorageModificationError::FolderNotFount(id))
        }
    }

    pub fn create_folder(
        &mut self,
        name: String,
        parent: FolderId,
    ) -> StorageModificationResult<()> {
        let folder = Folder::new(Some(parent), name, Metadata::now(0));
        let Some(parent) = self.folders.get_mut(&parent) else {
            return Err(StorageModificationError::FolderNotFount(parent));
        };
        parent.children.insert(folder.id);
        self.folders.insert(folder.id, folder);
        Ok(())
    }

    pub fn rename_asset(&mut self, id: AssetId, new_name: String) -> StorageModificationResult<()> {
        if let Some(asset) = self.assets.get_mut(&id) {
            asset.name = new_name;

            Ok(())
        } else {
            Err(StorageModificationError::AssetNotFount(id))
        }
    }

    pub fn rename_folder(
        &mut self,
        id: FolderId,
        new_name: String,
    ) -> StorageModificationResult<()> {
        if let Some(folder) = self.folders.get_mut(&id) {
            folder.name = new_name;
            Ok(())
        } else {
            Err(StorageModificationError::FolderNotFount(id))
        }
    }

    pub fn move_asset_to(
        &mut self,
        asset_id: AssetId,
        folder_id: FolderId,
    ) -> StorageModificationResult<()> {
        if let Some(asset) = self.assets.get(&asset_id) {
            if let Some(parent) = self.folders.get_mut(&asset.parent) {
                parent.content.remove(&asset_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&folder_id) {
                new_parent.content.insert(asset_id);
                Ok(())
            } else {
                Err(StorageModificationError::FolderNotFount(folder_id))
            }
        } else {
            Err(StorageModificationError::AssetNotFount(asset_id))
        }
    }

    pub fn move_folder_to(
        &mut self,
        src_id: FolderId,
        dst_id: FolderId,
    ) -> StorageModificationResult<()> {
        if let Some(src_folder) = self.folders.get(&src_id).cloned() {
            if let Some(parent) = src_folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&src_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&dst_id) {
                new_parent.children.insert(src_id);
                Ok(())
            } else {
                Err(StorageModificationError::FolderNotFount(dst_id))
            }
        } else {
            Err(StorageModificationError::FolderNotFount(src_id))
        }
    }

    pub fn get_asset_abs_path(&self, id: AssetId) -> StorageModificationResult<PathBuf> {
        self.assets
            .get(&id)
            .map(|a| self.root.join(IMAGE_ASSETS).join(a.get_file_name()))
            .ok_or_else(|| StorageModificationError::AssetNotFount(id))
    }

    pub fn get_asset_virtual_path(&self, id: AssetId) -> StorageModificationResult<Vec<String>> {
        if let Some(asset) = self.assets.get(&id) {
            self.get_folder_virtual_path(asset.parent).map(|mut p| {
                p.push(asset.get_file_name());
                p
            })
        } else {
            Err(StorageModificationError::AssetNotFount(id))
        }
    }

    pub fn get_folder_virtual_path(&self, id: FolderId) -> StorageModificationResult<Vec<String>> {
        let mut res = Vec::new();
        let mut cur_id = Some(id);
        while let Some(id) = cur_id {
            if let Some(folder) = self.folders.get(&id) {
                res.push(folder.name.clone());
                cur_id = folder.parent;
            } else {
                return Err(StorageModificationError::FolderNotFount(id));
            }
        }

        res.reverse();

        Ok(res)
    }
}

pub struct RawAsset {
    pub bytes: Vec<u8>,
    pub ext: Arc<str>,
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

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
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
    pub props: Option<AssetProperty>,
    pub meta: Metadata,
    pub checksums: Option<Checksums>,
    pub tags: Vec<TagId>,
}

impl Asset {
    pub fn new(
        parent: FolderId,
        name: String,
        ext: Arc<str>,
        meta: Metadata,
        ty: AssetType,
        props: Option<AssetProperty>,
    ) -> Self {
        Self {
            parent,
            id: AssetId(Uuid::new_v4()),
            ty,
            name,
            ext,
            props,
            meta,
            checksums: None,
            tags: Default::default(),
        }
    }

    pub fn get_file_name(&self) -> String {
        if self.ext.is_empty() {
            self.id.clone().0.to_string()
        } else {
            format!("{}.{}", self.id.0, self.ext)
        }
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

#[derive(Serialize, Deserialize, Default, Debug, Clone)]
pub enum AssetType {
    Image,
    #[default]
    Unknown,
}

impl AssetType {
    pub fn from_extension(ext: Option<&std::ffi::OsStr>) -> Self {
        match ext.and_then(|e| e.to_str()) {
            Some(ext) => Self::from_ext_str(ext),
            None => Self::Unknown,
        }
    }

    pub fn from_ext_str(ext: &str) -> Self {
        match ext {
            "png" | "jpg" | "jpeg" => Self::Image,
            _ => Self::Unknown,
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

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Checksums {
    pub crc32: u32,
    pub md5: Arc<str>,
    pub sha1: Arc<str>,
    pub sha256: Arc<str>,
}

impl Checksums {
    pub fn from_path(path: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let mut file = std::fs::File::open(path)?;
        let mut buf = file
            .metadata()
            .map(|m| Vec::with_capacity(m.len() as usize))
            .unwrap_or_default();
        file.read_to_end(&mut buf)?;

        Ok(Self {
            crc32: crc32fast::hash(&buf),
            md5: hex::encode(md5::compute(&buf).0).into(),
            sha1: hex::encode(<sha1::Sha1 as sha1::Digest>::digest(&buf)).into(),
            sha256: hex::encode(<sha2::Sha256 as sha2::Digest>::digest(&buf)).into(),
        })
    }
}

fn check_library_structure_validity(root_folder: impl AsRef<Path>) -> bool {
    let root = root_folder.as_ref();
    root.join(LIBRARY_STORAGE).exists() && root.join(IMAGE_ASSETS).exists()
}
