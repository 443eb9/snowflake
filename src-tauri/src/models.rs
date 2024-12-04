use std::{
    error::Error,
    fs::{copy, create_dir_all, metadata, read_dir, ReadDir},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::{DateTime, FixedOffset};
use filetime::FileTime;
use hashbrown::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub const LIBRARY_STORAGE: &str = "snowflake.json";
pub const TEMP_RECYCLE_BIN: &str = "recycle_bin";
pub const IMAGE_ASSETS: &str = "images";

fn collect_folders(
    src: &Path,
    root: &Path,
    dir: ReadDir,
    parent: &mut Folder,
    folders: &mut HashMap<FolderId, Folder>,
    assets: &mut HashMap<AssetId, Asset>,
) -> Result<(), std::io::Error> {
    for entry in dir {
        let entry = entry?;
        let std_meta = entry.metadata()?;
        let path = entry.path();
        let meta = Metadata::from_std_meta(&std_meta);
        let name = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        if std_meta.is_dir() {
            let mut folder = Folder::new(Some(parent.id), name, meta);
            collect_folders(
                src,
                root,
                read_dir(entry.path())?,
                &mut folder,
                folders,
                assets,
            )?;

            parent.children.insert(folder.id);
            folders.insert(folder.id, folder);
        } else {
            let ext = path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let asset = Asset::new(
                parent.id,
                name,
                ext.into(),
                meta,
                AssetType::from_extension(path.extension()),
            );

            copy(&path, root.join(IMAGE_ASSETS).join(asset.get_file_name()))?;
            parent.content.insert(asset.id);
            assets.insert(asset.id, asset);
        }
    }

    Ok(())
}

#[derive(Debug, Error)]
pub enum StorageError {
    #[error("Asset {0:?} not found.")]
    AssetNotFount(AssetId),
    #[error("Folder {0:?} not found.")]
    FolderNotFount(FolderId),
}

pub type StorageResult<T> = Result<T, StorageError>;

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FolderId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct AssetId(pub Uuid);

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct TagId(pub Uuid);

#[derive(Serialize, Deserialize)]
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
    ) -> Result<Self, Box<dyn Error>> {
        let src_root_folder = src_root_folder.as_ref();
        let root_path = root_folder.as_ref();
        let root_meta = metadata(root_path)?;
        let mut root_folder = Folder::new(
            None,
            root_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            Metadata::from_std_meta(&root_meta),
        );

        let _ = create_dir_all(root_path.join(IMAGE_ASSETS));
        let _ = create_dir_all(root_path.join(TEMP_RECYCLE_BIN));

        let mut folders = Default::default();
        let mut assets = Default::default();

        collect_folders(
            src_root_folder,
            root_path,
            read_dir(src_root_folder)?,
            &mut root_folder,
            &mut folders,
            &mut assets,
        )?;

        let root_id = root_folder.id;
        folders.insert(root_folder.id, root_folder);

        Ok(Self {
            root: root_path.to_path_buf(),
            root_id,
            tags: Default::default(),
            folders,
            assets,
        })
    }

    pub fn from_existing(root_folder: impl AsRef<Path>) -> Result<Self, std::io::Error> {
        let path = root_folder.as_ref().join(LIBRARY_STORAGE);
        let reader = std::fs::File::open(&path)?;
        Ok(serde_json::from_reader(reader)?)
    }

    pub fn save(&self) -> Result<(), std::io::Error> {
        Ok(std::fs::File::create(self.root.join(LIBRARY_STORAGE))?
            .write_all(serde_json::to_string(self)?.as_bytes())?)
    }

    pub fn delete_asset(&mut self, id: AssetId) -> StorageResult<()> {
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
            Err(StorageError::AssetNotFount(id))
        }
    }
    pub fn delete_folder(&mut self, id: FolderId) -> StorageResult<()> {
        if let Some(folder) = self.folders.remove(&id) {
            if let Some(parent) = folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&id);
            }
            Ok(())
        } else {
            Err(StorageError::FolderNotFount(id))
        }
    }

    pub fn rename_asset(&mut self, id: AssetId, new_name_no_ext: String) -> StorageResult<()> {
        if let Some(asset) = self.assets.get_mut(&id) {
            let path = Path::new(&asset.name);

            asset.name = match path.extension() {
                Some(ext) => format!("{}.{}", new_name_no_ext, ext.to_string_lossy().to_string()),
                None => new_name_no_ext,
            };

            Ok(())
        } else {
            Err(StorageError::AssetNotFount(id))
        }
    }

    pub fn rename_folder(&mut self, id: FolderId, new_name: String) -> StorageResult<()> {
        if let Some(folder) = self.folders.get_mut(&id) {
            folder.name = new_name;
            Ok(())
        } else {
            Err(StorageError::FolderNotFount(id))
        }
    }

    pub fn move_asset_to(&mut self, asset_id: AssetId, folder_id: FolderId) -> StorageResult<()> {
        if let Some(asset) = self.assets.get(&asset_id) {
            if let Some(parent) = self.folders.get_mut(&asset.parent) {
                parent.content.remove(&asset_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&folder_id) {
                new_parent.content.insert(asset_id);
                Ok(())
            } else {
                Err(StorageError::FolderNotFount(folder_id))
            }
        } else {
            Err(StorageError::AssetNotFount(asset_id))
        }
    }

    pub fn move_folder_to(&mut self, src_id: FolderId, dst_id: FolderId) -> StorageResult<()> {
        if let Some(src_folder) = self.folders.get(&src_id).cloned() {
            if let Some(parent) = src_folder.parent.and_then(|p| self.folders.get_mut(&p)) {
                parent.children.remove(&src_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&dst_id) {
                new_parent.children.insert(src_id);
                Ok(())
            } else {
                Err(StorageError::FolderNotFount(dst_id))
            }
        } else {
            Err(StorageError::FolderNotFount(src_id))
        }
    }

    pub fn get_asset_abs_path(&self, id: AssetId) -> StorageResult<PathBuf> {
        self.assets
            .get(&id)
            .map(|a| self.root.join(IMAGE_ASSETS).join(a.get_file_name()))
            .ok_or_else(|| StorageError::AssetNotFount(id))
    }

    pub fn get_asset_virtual_path(&self, id: AssetId) -> StorageResult<Vec<String>> {
        if let Some(asset) = self.assets.get(&id) {
            self.get_folder_virtual_path(asset.parent).map(|mut p| {
                p.push(asset.get_file_name());
                p
            })
        } else {
            Err(StorageError::AssetNotFount(id))
        }
    }

    pub fn get_folder_virtual_path(&self, id: FolderId) -> StorageResult<Vec<String>> {
        let mut res = Vec::new();
        let mut cur_id = Some(id);
        while let Some(id) = cur_id {
            if let Some(folder) = self.folders.get(&id) {
                res.push(folder.name.clone());
                cur_id = folder.parent;
            } else {
                return Err(StorageError::FolderNotFount(id));
            }
        }

        Ok(res)
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
pub struct Asset {
    pub parent: FolderId,
    pub id: AssetId,
    pub name: String,
    pub ty: AssetType,
    pub ext: Arc<str>,
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
    ) -> Self {
        Self {
            parent,
            id: AssetId(Uuid::new_v4()),
            ty,
            name,
            ext,
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
pub enum AssetType {
    Image,
    Unknown,
}

impl AssetType {
    pub fn from_extension(ext: Option<&std::ffi::OsStr>) -> Self {
        match ext.and_then(|e| e.to_str()) {
            Some(ext) => match ext {
                "png" | "jpg" => Self::Image,
                _ => Self::Unknown,
            },
            None => Self::Unknown,
        }
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
}

#[derive(Serialize, Deserialize, Debug, Clone)]
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
