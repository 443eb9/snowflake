use std::path::PathBuf;

use chrono::{DateTime, FixedOffset};
use hashbrown::HashMap;
use serde::{Deserialize, Serialize};
use thiserror::Error;

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
}

#[derive(Serialize, Deserialize, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub recent_libs: HashMap<PathBuf, RecentLib>,
}

impl AppData {
    pub fn read() -> Result<Self, AppDataError> {
        let dir = std::env::current_dir()?.join(DATA);
        if !dir.exists() {
            let data = Self::default();
            data.save()?;
            Ok(data)
        } else {
            let mut data = serde_json::from_reader::<_, AppData>(std::fs::File::open(dir)?)?;
            data.recent_libs = data
                .recent_libs
                .into_iter()
                .filter(|(p, _)| p.exists())
                .collect();
            Ok(data)
        }
    }

    pub fn save(&self) -> Result<(), AppDataError> {
        let dir = std::env::current_dir()?.join(DATA);
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
