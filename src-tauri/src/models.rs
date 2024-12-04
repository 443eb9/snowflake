use std::{
    error::Error,
    fs::{metadata, read_dir, ReadDir},
    io::{Read, Write},
    path::{Path, PathBuf},
    sync::Arc,
};

use chrono::{DateTime, FixedOffset};
use filetime::FileTime;
use hashbrown::{hash_map::Entry, HashMap, HashSet};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

pub const LIBRARY_STORAGE: &str = "snowflake.json";
pub const TEMP_RECYCLE_BIN: &str = "removed";

#[derive(Default)]
pub struct FsCache {
    pub root: Uuid,
    pub bin: Uuid,
    pub root_path: PathBuf,
    pub folders: HashMap<Uuid, Folder>,
    pub assets: HashMap<Uuid, Asset>,
}

impl FsCache {
    pub fn build(
        root_path: impl AsRef<Path>,
        storage: &mut Storage,
    ) -> Result<Self, std::io::Error> {
        let root_path = root_path.as_ref();
        let root_meta = Metadata::new(root_path);

        let bin_path = root_path.join(TEMP_RECYCLE_BIN);
        if !bin_path.exists() {
            let _ = std::fs::create_dir_all(&bin_path);
        }
        let bin_meta = Metadata::new(&bin_path);

        let mut cache = Self {
            root: root_meta.id,
            bin: bin_meta.id,
            root_path: root_path.to_path_buf(),
            ..Default::default()
        };
        cache
            .folders
            .insert(bin_meta.id, Folder::new(root_meta.id, bin_path, bin_meta));
        let mut root_folder = Folder::new(root_meta.id, root_path.to_path_buf(), root_meta);

        collect_cache(
            root_path,
            read_dir(root_path)?,
            &mut root_folder,
            &mut cache,
            storage,
        )?;

        cache.folders.insert(root_folder.meta.id, root_folder);

        Ok(cache)
    }

    pub fn delete_asset(&mut self, id: Uuid) -> Result<(), std::io::Error> {
        self.move_asset_to(id, self.bin)?;
        self.assets.remove(&id);

        Ok(())
    }
    pub fn delete_folder(&mut self, id: Uuid) -> Result<(), std::io::Error> {
        self.move_folder_to(id, self.bin)?;
        self.folders.remove(&id);

        Ok(())
    }

    pub fn rename_asset(
        &mut self,
        id: Uuid,
        new_name_no_ext: String,
    ) -> Result<(), std::io::Error> {
        if let Some(asset) = self.assets.get_mut(&id) {
            let ext = asset
                .path
                .extension()
                .map(|e| e.to_string_lossy().to_string());
            std::fs::rename(
                &asset.path,
                asset.path.with_file_name(match ext {
                    Some(ext) => format!("{}.{}", new_name_no_ext, ext),
                    None => new_name_no_ext,
                }),
            )?;
        }

        Ok(())
    }

    pub fn rename_folder(&mut self, id: Uuid, new_name: String) -> Result<(), std::io::Error> {
        if let Some(folder) = self.folders.get_mut(&id) {
            std::fs::rename(&folder.path, folder.path.with_file_name(new_name))?;
        }

        Ok(())
    }

    pub fn move_asset_to(&mut self, asset_id: Uuid, folder_id: Uuid) -> Result<(), std::io::Error> {
        if let Some(asset) = self.assets.get(&asset_id) {
            if let Some(parent) = self.folders.get_mut(&asset_id) {
                parent.content.remove(&asset_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&folder_id) {
                new_parent.content.insert(asset_id);
                std::fs::rename(
                    &asset.path,
                    new_parent.path.join(asset.path.file_name().unwrap()),
                )?;
            }
        }

        Ok(())
    }

    pub fn move_folder_to(&mut self, src_id: Uuid, dst_id: Uuid) -> Result<(), std::io::Error> {
        if let Some(src_folder) = self.folders.get(&src_id).cloned() {
            if let Some(parent) = self.folders.get_mut(&src_folder.parent) {
                parent.content.remove(&src_id);
            }
            if let Some(new_parent) = self.folders.get_mut(&dst_id) {
                new_parent.content.insert(src_id);
                std::fs::rename(
                    &src_folder.path,
                    new_parent.path.join(src_folder.path.file_name().unwrap()),
                )?;
            }
        }

        Ok(())
    }
}

fn collect_cache(
    root_path: &Path,
    dir: ReadDir,
    parent: &mut Folder,
    cache: &mut FsCache,
    storage: &mut Storage,
) -> Result<(), std::io::Error> {
    for entry in dir {
        let entry = entry?;
        let std_meta = entry.metadata()?;
        let path = entry.path();
        let mut meta = Metadata::from_std_meta(&std_meta);
        let relative = pathdiff::diff_paths(&path, &root_path).unwrap();

        match storage.path_to_id.entry(relative) {
            Entry::Occupied(e) => {
                meta.id = *e.get();
            }
            Entry::Vacant(e) => {
                e.insert(meta.id);
            }
        }

        if std_meta.is_dir() {
            let mut folder = Folder::new(parent.meta.id, path.to_path_buf(), meta);
            collect_cache(root_path, read_dir(&path)?, &mut folder, cache, storage)?;

            parent.children.insert(folder.meta.id);
            cache.folders.insert(folder.meta.id, folder);
        } else {
            parent.content.insert(meta.id);
            cache.assets.insert(
                meta.id,
                Asset {
                    parent: parent.meta.id,
                    ty: AssetType::from_extension(path.extension()),
                    name: path.file_name().unwrap().to_string_lossy().to_string(),
                    path,
                    meta,
                    checksums: None,
                },
            );
        }
    }

    Ok(())
}

#[derive(Default, Serialize, Deserialize)]
pub struct Storage {
    pub path_to_id: HashMap<PathBuf, Uuid>,
    pub tags: HashMap<Uuid, Tag>,
    pub item_tags: HashMap<Uuid, HashSet<Uuid>>,
}

impl Storage {
    pub fn from_path(root_folder: impl AsRef<Path>) -> Result<Self, Box<dyn Error>> {
        let path = root_folder.as_ref().join(LIBRARY_STORAGE);
        if !path.exists() {
            Ok(Default::default())
        } else {
            let reader = std::fs::File::open(&path)?;
            Ok(serde_json::from_reader(reader)?)
        }
    }

    pub fn save_to(&self, root_folder: impl AsRef<Path>) -> Result<(), Box<dyn Error>> {
        Ok(
            std::fs::File::create(root_folder.as_ref().join(LIBRARY_STORAGE))?
                .write_all(serde_json::to_string(self)?.as_bytes())?,
        )
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tag {
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

#[derive(Serialize, Clone)]
pub struct Folder {
    pub parent: Uuid,
    pub name: String,
    pub path: PathBuf,
    pub children: HashSet<Uuid>,
    pub content: HashSet<Uuid>,
    pub meta: Metadata,
}

impl Folder {
    pub fn new(parent: Uuid, path: PathBuf, meta: Metadata) -> Self {
        Self {
            parent,
            name: path.file_name().unwrap().to_string_lossy().to_string(),
            path,
            children: Default::default(),
            content: Default::default(),
            meta,
        }
    }
}

#[derive(Serialize, Debug, Clone)]
pub struct Asset {
    pub parent: Uuid,
    pub ty: AssetType,
    pub name: String,
    pub path: PathBuf,
    pub meta: Metadata,
    pub checksums: Option<Checksums>,
}

#[derive(Serialize, Debug, Clone, Copy)]
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
    pub id: Uuid,
    pub byte_size: u64,
    pub created_at: Option<DateTime<FixedOffset>>,
    pub last_modified: DateTime<FixedOffset>,
}

impl Metadata {
    pub fn new(path: impl AsRef<Path>) -> Self {
        Self::from_std_meta(metadata(path).as_ref().unwrap())
    }

    pub fn from_std_meta(meta: &std::fs::Metadata) -> Self {
        Self {
            id: Uuid::new_v4(),
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
