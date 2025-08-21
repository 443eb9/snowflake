use std::path::{Path, PathBuf};

use sqlx::{Pool, Sqlite, SqlitePool, pool::PoolConnection, sqlite::SqliteConnectOptions};
use thiserror::Error;

pub mod main_db;
pub mod models;

pub type Result<T> = std::result::Result<T, DatabaseError>;

#[derive(Error, Debug)]
pub enum DatabaseError {
    #[error(transparent)]
    Sqlx(#[from] sqlx::Error),
}

#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(path: impl AsRef<Path>) -> Result<Self> {
        let pool = SqlitePool::connect_with(
            SqliteConnectOptions::new()
                .filename(path)
                .create_if_missing(true),
        )
        .await?;

        Ok(Self { pool })
    }

    #[inline]
    pub fn pool(&self) -> SqlitePool {
        self.pool.clone()
    }
}
