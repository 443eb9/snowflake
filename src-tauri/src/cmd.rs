use std::sync::Mutex;

use hashbrown::HashMap;
use tauri::State;
use uuid::Uuid;

use crate::{
    err::{asset_doesnt_exist, cache_not_built, folder_doesnt_exist, storage_not_initialized},
    models::{Asset, Folder, FsCache, Storage, Tag},
};

#[tauri::command]
pub fn load_library(
    root_folder: String,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Start loading library at {}", root_folder);

    let mut fs_cache = fs_cache.lock().map_err(|e| e.to_string())?;
    fs_cache.replace(FsCache::build(&root_folder).map_err(|e| e.to_string())?);

    let mut storage = storage.lock().map_err(|e| e.to_string())?;
    storage.replace(Storage::from_path(&root_folder).map_err(|e| e.to_string())?);

    log::info!("Successfully loaded library!");

    Ok(())
}

#[tauri::command]
pub fn save_library(
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    if let (Ok(Some(fs_cache)), Ok(Some(storage))) =
        (fs_cache.lock().as_deref(), storage.lock().as_deref())
    {
        storage
            .save_to(&fs_cache.root_path)
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn get_folder_tree(
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<HashMap<Uuid, Folder>, String> {
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
pub fn get_root_folder_id(fs_cache: State<'_, Mutex<Option<FsCache>>>) -> Result<Uuid, String> {
    fs_cache
        .lock()
        .as_deref()
        .ok()
        .and_then(Option::as_ref)
        .map(|cache| cache.root)
        .ok_or_else(cache_not_built)
}

#[tauri::command]
pub fn get_all_tags(storage: State<'_, Mutex<Option<Storage>>>) -> Result<Vec<Tag>, String> {
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
    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.tags.insert(new_tag.meta.id, new_tag);
    }

    Ok(())
}

#[tauri::command]
pub fn get_assets_at(
    folder: Uuid,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Vec<Asset>, String> {
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
    folder: Uuid,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Folder, String> {
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
    asset: Uuid,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Asset, String> {
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
    assets: Vec<Uuid>,
    fs_cache: State<'_, Mutex<Option<FsCache>>>,
) -> Result<Vec<Asset>, String> {
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
    asset: Uuid,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Tag>, String> {
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
pub fn modify_tags_of(
    asset: Uuid,
    new_tags: Vec<Tag>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.item_tags.insert(
            asset,
            new_tags
                .into_iter()
                .map(|tag| {
                    let id = tag.meta.id;
                    storage.tags.insert(tag.meta.id, tag);
                    id
                })
                .collect(),
        );
        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_assets_containing_tag(
    tag: Uuid,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Uuid>, String> {
    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .item_tags
            .iter()
            .filter_map(|(item, tags)| tags.contains(&tag).then_some(*item))
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}
