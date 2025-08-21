use std::{
    fmt::Display,
    fs::{copy, metadata},
    path::{Path, PathBuf},
};

use chrono::{DateTime, Utc};
use filetime::FileTime;
use thiserror::Error;

use crate::{
    LibrarySource,
    data::{Id, Identifiable},
    sql::main_db::MainDatabase,
};

pub const ASSETS_STORAGE_ROOT: &'static str = "source";

#[derive(Debug, Clone)]
pub struct AssetMetadata {
    pub id: Id<AssetMetadata>,
    pub name: String,
    pub src: String,
    pub desc: String,
    pub extension: AssetExtension,
    pub size_bytes: u32,
    pub created_at: Option<DateTime<Utc>>,
    pub imported_at: DateTime<Utc>,
}

#[derive(Error, Debug)]
pub enum AssetImportError {
    #[error("Unknown extension.")]
    UnknownExtension,
    #[error("Invalid extension: {0}")]
    InvalidExtension(String),
    #[error(transparent)]
    Io(#[from] std::io::Error),
    #[error(transparent)]
    Database(#[from] crate::sql::DatabaseError),
}

impl AssetMetadata {
    pub fn original_file(&self, library: &LibrarySource) -> PathBuf {
        library
            .root
            .join(ASSETS_STORAGE_ROOT)
            .join(format!("{}.{}", self.id.id(), self.extension))
    }

    pub async fn import(
        path: impl AsRef<Path>,
        library: &LibrarySource,
    ) -> Result<Self, AssetImportError> {
        let path = path.as_ref();
        dbg!(&path);
        let extension = AssetExtension::try_from_path(&path).ok_or_else(|| {
            match path.extension().map(|s| s.to_string_lossy().to_string()) {
                Some(ext) => AssetImportError::InvalidExtension(ext),
                None => AssetImportError::UnknownExtension,
            }
        })?;

        let metadata = metadata(path)?;

        let asset = Self {
            id: Id::new(0),
            name: path
                .file_stem()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string(),
            src: path.to_string_lossy().to_string(),
            desc: Default::default(),
            extension,
            size_bytes: metadata.len() as u32,
            created_at: FileTime::from_creation_time(&metadata)
                .map(|at| DateTime::from_timestamp_nanos(at.nanoseconds() as i64)),
            imported_at: Utc::now(),
        };

        let id = library
            .main_db
            .add_asset(&asset.clone().into(), &[])
            .await?;

        copy(
            path,
            library
                .root
                .join(ASSETS_STORAGE_ROOT)
                .join(format!("{}.{}", id.id(), extension)),
        )?;

        Ok(AssetMetadata { id, ..asset })
    }
}

impl Identifiable for AssetMetadata {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u32)]
pub enum AssetExtension {
    Jpeg,
    Jpg,
    Png,
}

impl Display for AssetExtension {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            AssetExtension::Jpeg => write!(f, "jpeg"),
            AssetExtension::Jpg => write!(f, "jpg"),
            AssetExtension::Png => write!(f, "png"),
        }
    }
}

impl AssetExtension {
    pub fn try_from_path(path: impl AsRef<Path>) -> Option<Self> {
        let path = path.as_ref();
        let Some(extension) = path.extension().and_then(|e| e.to_str()) else {
            return None;
        };

        match extension.to_lowercase().as_str() {
            "jpeg" => Some(AssetExtension::Jpeg),
            "jpg" => Some(AssetExtension::Jpg),
            "png" => Some(AssetExtension::Png),
            _ => None,
        }
    }
}
