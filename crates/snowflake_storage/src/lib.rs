use std::path::{Path, PathBuf};

use crate::sql::main_db::MainDatabase;

pub mod data;
pub mod sql;

#[derive(Debug, Clone)]
pub struct LibrarySource {
    pub root: PathBuf,
    pub main_db: MainDatabase,
}

impl LibrarySource {
    pub async fn new(library_root: impl AsRef<Path>) -> crate::sql::Result<Self> {
        let root = library_root.as_ref().to_path_buf();
        let main_db = MainDatabase::connect(library_root).await?;
        main_db.init_tables().await;

        Ok(Self { root, main_db })
    }
}
