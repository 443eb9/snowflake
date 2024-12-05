use crate::app::{AssetId, FolderId};

pub fn storage_not_initialized() -> String {
    format!("Storage not initialized.")
}

pub fn asset_doesnt_exist(asset: AssetId) -> String {
    format!("Asset {:?} doesn't exist.", asset)
}

pub fn folder_doesnt_exist(folder: FolderId) -> String {
    format!("Folder {:?} doesn't exist.", folder)
}
