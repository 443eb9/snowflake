use std::{path::PathBuf, sync::Mutex};

use hashbrown::HashMap;
use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::{
    err::{asset_doesnt_exist, cache_not_built, folder_doesnt_exist, storage_not_initialized},
    models::{Asset, Checksums, Folder, FsCache, Storage, Tag},
};

#[tauri::command]
pub fn load_library(
    app: AppHandle,
    root_folder: String,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Start loading library at {}", root_folder);

    let mut new_storage = Storage::from_path(&root_folder).map_err(|e| e.to_string())?;
    let new_cache =
        FsCache::build(&root_folder, &mut new_storage, app).map_err(|e| e.to_string())?;
    let mut fs_cache = fs_cache.lock().map_err(|e| e.to_string())?;

    let mut storage = storage.lock().map_err(|e| e.to_string())?;
    new_storage
        .save_to(&new_cache.root)
        .map_err(|e| e.to_string())?;

    fs_cache.replace(new_cache);
    storage.replace(new_storage);

    log::info!("Successfully loaded library!");

    Ok(())
}

#[tauri::command]
pub fn save_library(
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Saving library...");

    if let (Ok(Some(fs_cache)), Ok(Some(storage))) =
        (fs_cache.lock().as_deref(), storage.lock().as_deref())
    {
        storage.save_to(&fs_cache.root).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_folder_tree(
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<HashMap<PathBuf, Folder>, String> {
    log::info!("Getting folder tree.");

    match fs_cache.lock() {
        Ok(ok) => {
            if let Some(cache) = ok.as_ref() {
                Ok(cache.folders.clone())
            } else {
                Ok(Default::default())
            }
        }
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn get_root_folder_id(fs_cache: State<'_, Mutex<Option<FsCache>>>) -> Result<PathBuf, String> {
    log::info!("Getting root folder id.");

    fs_cache
        .lock()
        .as_deref()
        .ok()
        .and_then(Option::as_ref)
        .map(|cache| cache.root.clone())
        .ok_or_else(cache_not_built)
}

#[tauri::command]
pub fn get_all_tags(storage: State<'_, Mutex<Option<Storage>>>) -> Result<Vec<Tag>, String> {
    log::info!("Getting all tags");

    storage
        .lock()
        .as_deref()
        .ok()
        .and_then(Option::as_ref)
        .map(|st| st.tags.values().into_iter().cloned().collect())
        .ok_or_else(storage_not_initialized)
}

#[tauri::command]
pub fn modify_tag(new_tag: Tag, storage: State<'_, Mutex<Option<Storage>>>) -> Result<(), String> {
    log::info!("Modifying tag: {:?}", new_tag);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.tags.insert(new_tag.id, new_tag);
    }

    Ok(())
}

#[tauri::command]
pub fn get_assets_at(
    folder: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Vec<Asset>, String> {
    log::info!("Getting assets at {:?}", folder);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref() {
        cache
            .folders
            .get(&folder)
            .map(|folder| {
                folder
                    .content
                    .iter()
                    .filter_map(|id| cache.assets.get(id).cloned())
                    .collect()
            })
            .ok_or_else(|| folder_doesnt_exist(folder))
    } else {
        Ok(Vec::new())
    }
}

#[tauri::command]
pub fn get_folder(
    folder: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Folder, String> {
    log::info!("Getting folder {:?}", folder);

    fs_cache
        .lock()
        .as_deref()
        .ok()
        .and_then(Option::as_ref)
        .and_then(|cache| cache.folders.get(&folder).cloned())
        .ok_or_else(|| folder_doesnt_exist(folder))
}

#[tauri::command]
pub fn get_asset(
    asset: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Asset, String> {
    log::info!("Getting asset {:?}", asset);

    fs_cache
        .lock()
        .as_deref()
        .ok()
        .and_then(Option::as_ref)
        .and_then(|cache| cache.assets.get(&asset).cloned())
        .ok_or_else(|| asset_doesnt_exist(asset))
}

#[tauri::command]
pub fn get_assets(
    assets: Vec<PathBuf>,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Vec<Asset>, String> {
    log::info!("Getting assets {:?}", assets);

    fs_cache
        .lock()
        .as_deref()
        .ok()
        .and_then(Option::as_ref)
        .map(|cache| {
            assets
                .iter()
                .filter_map(|id| cache.assets.get(id).cloned())
                .collect()
        })
        .ok_or_else(cache_not_built)
}

#[tauri::command]
pub fn get_tags_of(
    asset: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Tag>, String> {
    log::info!("Getting tags of {:?}", asset);

    storage
        .lock()
        .as_deref()
        .map_err(|e| e.to_string())
        .and_then(|s| s.as_ref().ok_or_else(storage_not_initialized))
        .and_then(|storage| {
            storage
                .item_tags
                .get(&asset)
                .map(|ids| {
                    Ok(ids
                        .iter()
                        .filter_map(|id| storage.tags.get(id).cloned())
                        .collect())
                })
                .unwrap_or_else(|| Ok(Vec::new()))
        })
}

#[tauri::command]
pub fn absolutize_path(
    path: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<PathBuf, String> {
    log::info!("Absolutizing path {:?}", path);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref() {
        Ok(cache.absolutize_path(path))
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn modify_tags_of(
    asset: PathBuf,
    new_tags: Vec<Tag>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Modifying tags of {:?}, new tags: {:?}", asset, new_tags);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if new_tags.is_empty() {
            storage.item_tags.remove(&asset);
        } else {
            storage.item_tags.insert(
                asset,
                new_tags
                    .into_iter()
                    .map(|tag| {
                        let id = tag.id;
                        storage.tags.insert(tag.id, tag);
                        id
                    })
                    .collect(),
            );
        }
        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_assets_containing_tag(
    tag: Uuid,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<PathBuf>, String> {
    log::info!("Getting assets containing tag {}", tag);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .item_tags
            .iter()
            .filter_map(|(item, tags)| tags.contains(&tag).then(|| item.clone()))
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn compute_checksum(
    asset: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Asset, String> {
    log::info!("Compute checksum of {:?}", asset);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        let root = cache.root.clone();

        if let Some(asset) = cache.assets.get_mut(&asset) {
            if asset.checksums.is_none() {
                match Checksums::from_path(root.join(&asset.relative_path)) {
                    Ok(checksum) => {
                        asset.checksums.replace(checksum);
                    }
                    Err(err) => return Err(err.to_string()),
                }
            }

            Ok(asset.clone())
        } else {
            Err(asset_doesnt_exist(asset))
        }
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn delete_assets(
    assets: Vec<PathBuf>,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<(), String> {
    log::info!("Deleting assets {:?}", assets);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        for asset in assets {
            cache.delete_asset(asset).map_err(|e| e.to_string())?
        }
        Ok(())
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn delete_folders(
    folders: Vec<PathBuf>,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<(), String> {
    log::info!("Deleting folders {:?}", folders);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        for folder in folders {
            cache.delete_folder(folder).map_err(|e| e.to_string())?
        }
        Ok(())
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn rename_asset(
    asset: PathBuf,
    name_no_ext: String,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<(), String> {
    log::info!("Renaming asset {:?}", asset);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        cache
            .rename_asset(asset, name_no_ext)
            .map_err(|e| e.to_string())
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn rename_folder(
    folder: PathBuf,
    name: String,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<(), String> {
    log::info!("Renaming folder {:?} -> {}", folder, name);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        cache.rename_folder(folder, name).map_err(|e| e.to_string())
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn move_assets_to(
    assets: Vec<PathBuf>,
    folder: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<(), String> {
    log::info!("Moving assets {:?} to {:?}", assets, folder);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        for asset in assets {
            cache
                .move_asset_to(asset, folder.clone())
                .map_err(|e| e.to_string())?
        }
        Ok(())
    } else {
        Err(cache_not_built())
    }
}

#[tauri::command]
pub fn move_folders_to(
    src_folders: Vec<PathBuf>,
    dst_folder: PathBuf,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<(), String> {
    log::info!("Moving folders {:?} to {:?}", src_folders, dst_folder);

    if let Ok(Some(cache)) = fs_cache.lock().as_deref_mut() {
        for src_folder in src_folders {
            cache
                .move_folder_to(src_folder, dst_folder.clone())
                .map_err(|e| e.to_string())?;
        }
        Ok(())
    } else {
        Err(cache_not_built())
    }
}
