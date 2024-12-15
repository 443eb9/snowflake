use std::{
    fs::{copy, create_dir_all},
    path::{Path, PathBuf},
    sync::Mutex,
};

use chrono::Local;
use file_format::{FileFormat, Kind};
use futures::StreamExt;
use hashbrown::{HashMap, HashSet};
use reqwest::Client;
use serde::Deserialize;
use tauri::{ipc::Channel, AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};
use uuid::Uuid;

use crate::{
    app::{
        AppData, AppError, Asset, AssetId, AssetProperty, AssetType, DuplicateAssets, Folder,
        FolderId, Item, ItemId, LibraryMeta, LibraryStatistics, RawAsset, RecentLib, ResourceCache,
        SettingsDefault, SettingsValue, Storage, Tag, TagId, UserSettings,
    },
    err::{asset_doesnt_exist, folder_doesnt_exist, storage_not_initialized},
    event::{DownloadEvent, DownloadStatus},
};

#[tauri::command]
pub fn get_recent_libraries(data: State<'_, Mutex<AppData>>) -> Result<Vec<RecentLib>, String> {
    log::info!("Getting recent libraries.");
    let data = data.lock().map_err(|e| e.to_string())?;
    Ok(data.recent_libs.values().cloned().collect())
}

#[tauri::command]
pub fn get_user_settings(data: State<'_, Mutex<AppData>>) -> Result<UserSettings, String> {
    log::info!("Getting user settings.");
    let data = data.lock().map_err(|e| e.to_string())?;
    Ok(data.settings.clone())
}

#[tauri::command]
pub fn get_library_meta(storage: State<'_, Mutex<Option<Storage>>>) -> Result<LibraryMeta, String> {
    log::info!("Getting library meta.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.lib_meta.clone())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_default_settings(
    data: State<'_, ResourceCache>,
) -> Result<HashMap<String, HashMap<String, SettingsDefault>>, String> {
    log::info!("Getting default settings.");
    Ok(data.settings.clone())
}

#[tauri::command]
pub fn set_user_setting(
    tab: String,
    item: String,
    value: SettingsValue,
    data: State<'_, Mutex<AppData>>,
    resource: State<'_, ResourceCache>,
) -> Result<(), String> {
    log::info!("Getting user settings.");

    let mut data = data.lock().map_err(|e| e.to_string())?;

    let default = resource
        .settings
        .get(&tab)
        .and_then(|t| t.get(&item))
        .ok_or_else(|| "No settings found.".to_string())?;

    let original = data
        .settings
        .entry(tab)
        .or_default()
        .entry(item)
        .or_insert_with(|| default.clone().default_value());

    match default {
        SettingsDefault::Selection { candidates, .. } => match value {
            SettingsValue::Name(new) => {
                if candidates.contains(&new) {
                    *original = SettingsValue::Name(new);
                } else {
                    return Err("Incompatible value".into());
                }
            }
            _ => return Err("Incompatible value".into()),
        },
        SettingsDefault::Sequence(_) => match value {
            SettingsValue::Sequence(new) => *original = SettingsValue::Sequence(new),
            _ => return Err("Incompatible value".into()),
        },
        SettingsDefault::Toggle(_) => match value {
            SettingsValue::Toggle(new) => *original = SettingsValue::Toggle(new),
            _ => return Err("Incompatible value".into()),
        },
    }

    Ok(())
}

#[tauri::command]
pub fn load_library(
    root_folder: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
    app: AppHandle,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Start loading library at {:?}", root_folder);

    let new_storage = Storage::from_existing(&root_folder).map_err(|e| e.to_string())?;

    let mut data = data.lock().map_err(|e| e.to_string())?;
    data.recent_libs.insert(
        root_folder.clone(),
        RecentLib {
            name: new_storage.lib_meta.name.clone(),
            path: root_folder,
            last_open: Local::now().into(),
        },
    );

    let duplication = new_storage.cache.get_all_duplication();
    let mut storage = storage.lock().map_err(|e| e.to_string())?;
    storage.replace(new_storage);
    data.save(&app).map_err(|e| e.to_string())?;

    Ok(DuplicateAssets(duplication).reduce())
}

#[tauri::command]
pub fn initialize_library(
    src_root_folder: PathBuf,
    root_folder: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
    app: AppHandle,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Start initializing library at {:?}", root_folder);

    let mut new_storage =
        Storage::from_constructed(&src_root_folder, &root_folder).map_err(|e| e.to_string())?;
    new_storage.save().map_err(|e| e.to_string())?;

    let mut data = data.lock().map_err(|e| e.to_string())?;
    data.recent_libs.insert(
        root_folder.clone(),
        RecentLib {
            name: new_storage.lib_meta.name.clone(),
            path: root_folder,
            last_open: Local::now().into(),
        },
    );

    let duplication = new_storage.cache.get_all_duplication();

    let mut storage = storage.lock().map_err(|e| e.to_string())?;
    storage.replace(new_storage);
    data.save(&app).map_err(|e| e.to_string())?;

    Ok(DuplicateAssets(duplication).reduce())
}

#[tauri::command]
pub fn save_library(storage: State<'_, Mutex<Option<Storage>>>) -> Result<(), String> {
    log::info!("Saving library...");

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.save().map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub fn unload_library(storage: State<'_, Mutex<Option<Storage>>>) -> Result<(), String> {
    log::info!("Unloading library.");

    if let Ok(mut storage) = storage.lock() {
        if let Some(storage) = storage.as_mut() {
            storage.save().map_err(|e| e.to_string())?;
        }
        storage.take();
    }

    Ok(())
}

fn export_recursion(storage: &Storage, folder: &FolderId, path: &Path) -> Result<(), AppError> {
    if let Some(folder) = storage.folders.get(folder) {
        let folder_path = path.join(&folder.name);
        let _ = create_dir_all(&folder_path);

        for asset in &folder.content {
            if let Some(asset) = storage.assets.get(asset) {
                copy(
                    asset.get_file_path(&storage.cache.root),
                    folder_path.join(asset.get_file_name()),
                )?;
            }
        }

        for child in &folder.children {
            export_recursion(storage, child, &folder_path)?;
        }
    }

    Ok(())
}

#[tauri::command]
pub fn export_library(
    root_folder: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Exporting library to {:?}", root_folder);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        export_recursion(&storage, &storage.root_id, &root_folder).map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn gen_statistics(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<LibraryStatistics, String> {
    log::info!("Generating statistics.");

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        Ok(storage.gen_statistics())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn import_assets(
    path: Vec<PathBuf>,
    parent: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Importing assets {:?} into folder {:?}.", path, parent);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage
            .add_assets(path, parent)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn change_library_name(
    name: String,
    data: State<'_, Mutex<AppData>>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Changing library name into {}", name);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if let Some(data) = data
            .lock()
            .as_deref_mut()
            .ok()
            .and_then(|d| d.recent_libs.get_mut(&storage.cache.root))
        {
            data.name = name.clone();
        }

        storage.lib_meta.name = name;
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub async fn import_web_assets(
    urls: Vec<String>,
    parent: FolderId,
    storage: State<'_, Mutex<Option<Storage>>>,
    progress: Channel<DownloadEvent>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!(
        "Importing assets from web {:?} into folder {:?}.",
        urls,
        parent
    );

    let client = Client::new();
    let mut results = Vec::with_capacity(urls.len());

    for (index, url) in urls.into_iter().enumerate() {
        let id = index as u32;
        let request = match client.get(&url).build() {
            Ok(req) => req,
            Err(err) => {
                let _ = progress.send(DownloadEvent {
                    id,
                    downloaded: 0.0,
                    total: None,
                    status: DownloadStatus::Error(err.to_string()),
                });
                continue;
            }
        };

        let _ = progress.send(DownloadEvent {
            id,
            downloaded: 0.0,
            total: None,
            status: DownloadStatus::SendingGet,
        });
        let response = client.execute(request).await;

        match response {
            Ok(ok) => {
                let total = ok.content_length();
                let total_f = total.map(|t| t as f32);

                let mut content = Vec::new();
                let mut stream = ok.bytes_stream();

                let _ = progress.send(DownloadEvent {
                    id,
                    downloaded: 0.0,
                    total: total_f,
                    status: DownloadStatus::Started,
                });

                while let Some(Ok(bytes)) = stream.next().await {
                    content.extend(bytes);

                    let _ = progress.send(DownloadEvent {
                        id,
                        downloaded: content.len() as f32,
                        total: total_f,
                        status: DownloadStatus::Ongoing,
                    });
                }

                let _ = progress.send(DownloadEvent {
                    id,
                    downloaded: f32::MAX,
                    total: total_f,
                    status: DownloadStatus::Finished,
                });

                let fmt = FileFormat::from_bytes(&content);

                if fmt.kind() != Kind::Image {
                    let _ = progress.send(DownloadEvent {
                        id,
                        downloaded: f32::MAX,
                        total: total_f,
                        status: DownloadStatus::Error(format!(
                            "Failed to import non-image assets. {}",
                            fmt.media_type()
                        )),
                    });
                    continue;
                }

                results.push(RawAsset {
                    bytes: content,
                    ty: AssetType::from_fmt(fmt).unwrap(),
                    ext: fmt.extension().into(),
                    src: url,
                });
            }
            Err(err) => {
                let _ = progress.send(DownloadEvent {
                    id,
                    downloaded: 0.0,
                    total: None,
                    status: DownloadStatus::Error(err.to_string()),
                });
            }
        }
    }

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let duplication = storage
            .add_raw_assets(results, parent)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;
        Ok(duplication.reduce())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn recover_items(
    items: Vec<ItemId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Recovering items {:?}", items);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let duplication = storage
            .recover_items(items, true)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;
        Ok(duplication.reduce())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_recycle_bin(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<HashSet<ItemId>, String> {
    log::info!("Getting recycle bin.");

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        Ok(storage.recycle_bin.clone())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_duplicated_assets(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<DuplicateAssets, String> {
    log::info!("Getting duplicated assets.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(DuplicateAssets(
            storage
                .cache
                .crc_lookup
                .clone()
                .into_iter()
                .filter(|(_, assets)| assets.len() > 1)
                .collect(),
        ))
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
        Ok(storage
            .folders
            .clone()
            .into_iter()
            .filter(|(_, f)| !f.is_deleted)
            .collect())
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
        storage.save().map_err(|e| e.to_string())
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
pub fn get_items(
    items: Vec<Uuid>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Item>, String> {
    log::info!("Getting items {:?}", items);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(items
            .into_iter()
            .filter_map(|item| {
                let asset = storage.assets.get(&AssetId(item));
                let folder = storage.folders.get(&FolderId(item));

                if asset.is_some() && folder.is_none() {
                    Some(Item::Asset(asset.unwrap().clone()))
                } else if asset.is_none() && folder.is_some() {
                    Some(Item::Folder(folder.unwrap().clone()))
                } else {
                    None
                }
            })
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
    assets: Vec<AssetId>,
    new_tags: Vec<TagId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Modifying tags of {:?}, new tags: {:?}", assets, new_tags);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for asset in assets {
            let asset = storage
                .assets
                .get_mut(&asset)
                .ok_or_else(|| asset_doesnt_exist(asset))?;
            asset.tags = new_tags.clone();
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[derive(Debug, serde::Deserialize)]
pub enum DeltaMode {
    Add,
    Remove,
}

#[tauri::command]
pub fn delta_tags_of(
    assets: Vec<AssetId>,
    tags: HashSet<TagId>,
    mode: DeltaMode,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Delating tags of {:?}, {:?} tags: {:?}", assets, mode, tags);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for asset in assets {
            let asset = storage
                .assets
                .get_mut(&asset)
                .ok_or_else(|| asset_doesnt_exist(asset))?;

            let unique_tags = asset
                .tags
                .clone()
                .into_iter()
                .filter(|t| !tags.contains(t))
                .collect();

            asset.tags = match mode {
                DeltaMode::Add => tags.clone().into_iter().chain(unique_tags).collect(),
                DeltaMode::Remove => unique_tags,
            }
        }

        storage.save().map_err(|e| e.to_string())
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
pub fn modify_src_of(
    asset: AssetId,
    src: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Modifying src of {:?} to {}", asset, src);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if let Some(asset) = storage.assets.get_mut(&asset) {
            asset.src = src;
            storage.save().map_err(|e| e.to_string())
        } else {
            Err(asset_doesnt_exist(asset))
        }
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn delete_assets(
    assets: Vec<AssetId>,
    permanently: bool,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Deleting assets {:?}, permanently: {}", assets, permanently);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if permanently {
            for asset in assets {
                storage.delete_asset(asset).map_err(|e| e.to_string())?;
            }
        } else {
            for asset in assets {
                storage
                    .move_asset_to_recycle_bin(asset)
                    .map_err(|e| e.to_string())?;
            }
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn delete_folders(
    folders: Vec<FolderId>,
    permanently: bool,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!(
        "Deleting folders {:?}, permanently: {}",
        folders,
        permanently
    );

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if permanently {
            for folder in folders {
                storage.delete_folder(folder).map_err(|e| e.to_string())?;
            }
        } else {
            for folder in folders {
                storage
                    .move_folder_to_recycle_bin(folder)
                    .map_err(|e| e.to_string())?;
            }
        }

        storage.save().map_err(|e| e.to_string())
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

        storage.save().map_err(|e| e.to_string())
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
        storage
            .rename_asset(asset, name)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
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
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
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

        storage.save().map_err(|e| e.to_string())
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

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum QuickRefTy {
    Asset(Vec<AssetId>),
    Folder(FolderId),
    Tag(TagId),
}

#[tauri::command]
pub async fn quick_ref(
    ty: QuickRefTy,
    storage: State<'_, Mutex<Option<Storage>>>,
    app: AppHandle,
) -> Result<(), String> {
    log::info!("Creating quick refs {:?}", ty);

    let Some(main_window) = app.get_webview_window("main") else {
        return Err("Main window not found.".into());
    };

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        let ids: Vec<_> = match &ty {
            QuickRefTy::Asset(ids) => ids.iter().collect(),
            QuickRefTy::Folder(id) => storage
                .folders
                .get(id)
                .ok_or_else(|| folder_doesnt_exist(*id))?
                .content
                .iter()
                .collect(),
            QuickRefTy::Tag(id) => storage
                .assets
                .values()
                .filter_map(|a| a.tags.contains(&id).then_some(&a.id))
                .collect(),
        };

        for asset in ids {
            let Some(asset) = storage.assets.get(asset) else {
                return Err(asset_doesnt_exist(*asset));
            };

            // TODO remove this once models get supported, as this pattern would be refutable then.
            #[allow(irrefutable_let_patterns)]
            let AssetProperty::RasterGraphics(properties) = &asset.props
            else {
                continue;
            };

            WebviewWindowBuilder::new(
                &app,
                format!("quickref-{}", asset.id.0.to_string()),
                WebviewUrl::App(format!("quickref/{}", asset.id.0).into()),
            )
            .inner_size(properties.width as f64, properties.height as f64)
            .skip_taskbar(true)
            .always_on_top(true)
            .decorations(false)
            .resizable(false)
            .parent(&main_window)
            .map_err(|e| e.to_string())?
            .build()
            .map_err(|e| e.to_string())?;
        }

        main_window
            .set_size(tauri::PhysicalSize::new(200, 200))
            .unwrap();

        Ok(())
    } else {
        Err(storage_not_initialized())
    }
}
