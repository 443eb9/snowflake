use chrono::DateTime;
use serde::{Deserialize, Serialize};
use sqlx::prelude::FromRow;

use crate::data::{AssetMetadata, Color, Id, Tag};

#[derive(FromRow, Serialize, Deserialize)]
pub struct RawAssetMetadata {
    pub id: u32,
    pub name: String,
    pub src: String,
    pub desc: String,
    pub extension: u32,
    pub size_bytes: u32,
    pub created_at: Option<u32>,
    pub imported_at: u32,
}

impl Into<AssetMetadata> for RawAssetMetadata {
    fn into(self) -> AssetMetadata {
        AssetMetadata {
            id: Id::new(self.id),
            name: self.name,
            src: self.src,
            desc: self.desc,
            // SAFETY:
            // - AssetType is repred into u32
            extension: unsafe { std::mem::transmute(self.extension) },
            size_bytes: self.size_bytes,
            created_at: self
                .created_at
                .map(|at| DateTime::from_timestamp_nanos(at as i64)),
            imported_at: DateTime::from_timestamp_nanos(self.imported_at as i64),
        }
    }
}

impl From<AssetMetadata> for RawAssetMetadata {
    fn from(value: AssetMetadata) -> Self {
        RawAssetMetadata {
            id: value.id.id(),
            name: value.name,
            src: value.src,
            desc: value.desc,
            extension: unsafe { std::mem::transmute(value.extension) },
            size_bytes: value.size_bytes,
            created_at: value
                .created_at
                .map(|at| at.timestamp_nanos_opt().unwrap() as u32),
            imported_at: value.imported_at.timestamp_nanos_opt().unwrap() as u32,
        }
    }
}

#[derive(FromRow, Serialize, Deserialize)]
pub struct RawTag {
    pub id: u32,
    pub name: String,
    pub color: u32,
    pub created_at: u32,
}

impl Into<Tag> for RawTag {
    fn into(self) -> Tag {
        Tag {
            id: Id::new(self.id),
            name: self.name,
            color: Color::from_packed(self.color),
            created_at: DateTime::from_timestamp_nanos(self.created_at as i64),
        }
    }
}

impl From<Tag> for RawTag {
    fn from(value: Tag) -> Self {
        RawTag {
            id: value.id.id(),
            name: value.name,
            color: value.color.into_packed(),
            created_at: value.created_at.timestamp_nanos_opt().unwrap() as u32,
        }
    }
}
