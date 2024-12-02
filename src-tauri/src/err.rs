use uuid::Uuid;

pub fn storage_not_initialized() -> String {
    format!("Storage not initialized.")
}

pub fn cache_not_built() -> String {
    format!("Cache not built")
}

pub fn asset_doesnt_exist(asset: Uuid) -> String {
    format!("Asset {} doesn't exist.", asset)
}

pub fn folder_doesnt_exist(folder: Uuid) -> String {
    format!("Folder {} doesn't exist.", folder)
}
