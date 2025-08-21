use std::collections::HashMap;

use snowflake_storage::data::{AssetMetadata, Id, Tag};

use snowflake_storage::LibrarySource;

#[derive(Debug, Default, Clone)]
pub struct LibraryCache {
    pub tags: Vec<Tag>,
    pub displayed_assets: Vec<AssetMetadata>,
    pub selected_tags: HashMap<Id<Tag>, Tag>,
    pub selected_assets: HashMap<Id<AssetMetadata>, AssetMetadata>,
}

impl LibraryCache {
    pub async fn new(source: LibrarySource) -> snowflake_storage::sql::Result<Self> {
        Ok(Self {
            tags: source.main_db.get_all_tags().await?,
            displayed_assets: Default::default(),
            selected_tags: Default::default(),
            selected_assets: Default::default(),
        })
    }
}
