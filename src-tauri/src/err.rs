use crate::app::AssetId;

pub fn storage_not_initialized() -> String {
    format!("Storage not initialized.")
}

pub fn asset_doesnt_exist(asset: AssetId) -> String {
    format!("Asset {:?} doesn't exist.", asset)
}
