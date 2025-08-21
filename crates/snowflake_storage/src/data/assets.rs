use std::{fmt::Display, path::PathBuf};

use chrono::{DateTime, Utc};

use crate::data::{Id, Identifiable};

#[derive(Debug, Clone)]
pub struct AssetMetadata {
    pub id: Id<AssetMetadata>,
    pub name: String,
    pub src: String,
    pub desc: String,
    pub path: PathBuf,
    pub extension: AssetExtension,
    pub size_bytes: u32,
    pub created_at: DateTime<Utc>,
    pub imported_at: DateTime<Utc>,
}

impl AssetMetadata {
    pub fn original_file(&self) -> PathBuf {
        self.path.clone()
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
