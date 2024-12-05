use std::{path::PathBuf, sync::Mutex};

use chrono::Local;
use hashbrown::HashMap;
use tauri::State;

use crate::{
    app::{AppData, Asset, AssetId, Checksums, Folder, FolderId, RecentLib, Storage, Tag, TagId},
    err::{asset_doesnt_exist, folder_doesnt_exist, storage_not_initialized},
};

#[tauri::command]
pub fn get_recent_libraries(data: State<'_, Mutex<AppData>>) -> Result<Vec<RecentLib>, String> {
    let data = data.lock().map_err(|e| e.to_string())?;
    Ok(data.recent_libs.values().cloned().collect())
}

#[tauri::command]
pub fn load_library(
    root_folder: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    log::info!("Start loading library at {:?}", root_folder);

    let new_storage = Storage::from_existing(&root_folder).map_err(|e| e.to_string())?;
    let mut storage = storage.lock().map_err(|e| e.to_string())?;
    storage.replace(new_storage);

    let mut data = data.lock().map_err(|e| e.to_string())?;
    data.recent_libs.insert(
        root_folder.clone(),
        RecentLib {
            name: root_folder
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string(),
            path: root_folder,
            last_open: Local::now().into(),
        },
    );
    data.save().map_err(|e| e.to_string())?;

    log::info!("Successfully loaded library!");

    Ok(())
}

#[tauri::command]
pub fn initialize_library(
    src_root_folder: PathBuf,
    root_folder: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    log::info!("Start initializing library at {:?}", root_folder);

    let new_storage =
        Storage::from_constructed(&src_root_folder, &root_folder).map_err(|e| e.to_string())?;
    let mut storage = storage.lock().map_err(|e| e.to_string())?;
    storage.replace(new_storage);

    let mut data = data.lock().map_err(|e| e.to_string())?;
    data.recent_libs.insert(
        root_folder.clone(),
        RecentLib {
            name: root_folder
                .file_name()
                .unwrap()
                .to_string_lossy()
                .to_string(),
            path: root_folder,
            last_open: Local::now().into(),
        },
    );
    data.save().map_err(|e| e.to_string())?;

    log::info!("Successfully initialized library!");

    Ok(())
}

#[tauri::command]
pub fn save_library(storage: State<'_, Mutex<Option<Storage>>>) -> Result<(), String> {
    log::info!("Saving library...");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage.save().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn import_assets(
    path: Vec<PathBuf>,
    parent: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Importing assets {:?} into folder {:?}.", path, parent);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.add_assets(path, parent).map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_asset_abs_path(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<PathBuf, String> {
    log::info!("Getting absolute path of asset {:?}.", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage.get_asset_abs_path(asset).map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_asset_virtual_path(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<String>, String> {
    log::info!("Getting virtual path of asset {:?}.", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage
            .get_asset_virtual_path(asset)
            .map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_folder_virtual_path(
    folder: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<String>, String> {
    log::info!("Getting virtual path of folder {:?}.", folder);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage
            .get_folder_virtual_path(folder)
            .map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_folder_tree(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<HashMap<FolderId, Folder>, String> {
    log::info!("Getting folder tree.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.folders.clone())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_root_folder_id(storage: State<'_, Mutex<Option<Storage>>>) -> Result<FolderId, String> {
    log::info!("Getting root folder id.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.root_id)
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_all_tags(storage: State<'_, Mutex<Option<Storage>>>) -> Result<Vec<Tag>, String> {
    log::info!("Getting all tags");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.tags.values().cloned().collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn modify_tag(new_tag: Tag, storage: State<'_, Mutex<Option<Storage>>>) -> Result<(), String> {
    log::info!("Modifying tag: {:?}", new_tag);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.tags.insert(new_tag.id, new_tag);
        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_assets_at(
    folder: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Asset>, String> {
    log::info!("Getting assets at {:?}", folder);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        let folder = storage
            .folders
            .get(&folder)
            .ok_or_else(|| folder_doesnt_exist(folder))?;
        Ok(folder
            .content
            .iter()
            .filter_map(|a| storage.assets.get(a))
            .cloned()
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_folder(
    folder: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Folder, String> {
    log::info!("Getting folder {:?}", folder);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage
            .folders
            .get(&folder)
            .ok_or_else(|| folder_doesnt_exist(folder))
            .cloned()
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_asset(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Asset, String> {
    log::info!("Getting asset {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage
            .assets
            .get(&asset)
            .ok_or_else(|| asset_doesnt_exist(asset))
            .cloned()
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_assets(
    assets: Vec<AssetId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Asset>, String> {
    log::info!("Getting assets {:?}", assets);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(assets
            .into_iter()
            .filter_map(|a| storage.assets.get(&a))
            .cloned()
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_tags(
    tags: Vec<TagId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Tag>, String> {
    log::info!("Getting tags {:?}", tags);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(tags
            .into_iter()
            .filter_map(|t| storage.tags.get(&t))
            .cloned()
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn modify_tags_of(
    asset: AssetId,
    new_tags: Vec<TagId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Modifying tags of {:?}, new tags: {:?}", asset, new_tags);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let asset = storage
            .assets
            .get_mut(&asset)
            .ok_or_else(|| asset_doesnt_exist(asset))?;
        asset.tags = new_tags;
        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_assets_containing_tag(
    tag: TagId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<AssetId>, String> {
    log::info!("Getting assets containing tag {:?}", tag);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .assets
            .values()
            .filter_map(|asset| asset.tags.contains(&tag).then_some(asset.id))
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn compute_checksum(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Asset, String> {
    log::info!("Compute checksum of {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let path = storage
            .get_asset_abs_path(asset)
            .map_err(|e| e.to_string())?;

        let asset = storage
            .assets
            .get_mut(&asset)
            .ok_or_else(|| asset_doesnt_exist(asset))?;

        if asset.checksums.is_none() {
            asset
                .checksums
                .replace(Checksums::from_path(path).map_err(|e| e.to_string())?);
        }

        Ok(asset.clone())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn delete_assets(
    assets: Vec<AssetId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Deleting assets {:?}", assets);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for asset in assets {
            if let Err(e) = storage.delete_asset(asset) {
                return Err(e.to_string());
            }
        }

        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn delete_folders(
    folders: Vec<FolderId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Deleting folders {:?}", folders);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for folder in folders {
            if let Err(e) = storage.delete_folder(folder) {
                return Err(e.to_string());
            }
        }

        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn create_folders(
    folder_names: Vec<String>,
    parent: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Creating folders {:?} in {:?}", folder_names, parent);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for folder in folder_names {
            storage
                .create_folder(folder, parent)
                .map_err(|e| e.to_string())?;
        }

        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn rename_asset(
    asset: AssetId,
    name: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Renaming asset {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.rename_asset(asset, name).map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn rename_folder(
    folder: FolderId,
    name: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Renaming folder {:?} -> {}", folder, name);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage
            .rename_folder(folder, name)
            .map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn move_assets_to(
    assets: Vec<AssetId>,
    folder: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Moving assets {:?} to {:?}", assets, folder);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for asset in assets {
            if let Err(e) = storage.move_asset_to(asset, folder) {
                return Err(e.to_string());
            }
        }

        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn move_folders_to(
    src_folders: Vec<FolderId>,
    dst_folder: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Moving folders {:?} to {:?}", src_folders, dst_folder);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for folder in src_folders {
            if let Err(e) = storage.move_folder_to(folder, dst_folder) {
                return Err(e.to_string());
            }
        }

        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}
