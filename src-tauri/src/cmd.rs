use std::{fs::write, path::PathBuf, sync::Mutex};

use base64::Engine;
use chrono::Local;
use file_format::{FileFormat, Kind};
use futures::StreamExt;
use hashbrown::{HashMap, HashSet};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::{
    app::{
        AppData, Asset, AssetId, AssetProperty, AssetType, Collection, CollectionId, Color,
        DuplicateAssets, GltfPreviewCamera, IdType, Item, ItemId, LibraryMeta, LibraryStatistics,
        RawAsset, RecentLib, ResourceCache, SettingsDefault, SettingsValue, Storage, Tag, TagId,
        UserSettings, CACHE,
    },
    err::{asset_doesnt_exist, storage_not_initialized},
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
pub fn get_user_setting(
    category: String,
    item: String,
    data: State<'_, Mutex<AppData>>,
) -> Result<Option<SettingsValue>, String> {
    log::info!("Getting user setting. {} {}", category, item);

    let data = data.lock().map_err(|e| e.to_string())?;
    Ok(data
        .settings
        .get(&category)
        .and_then(|cate| cate.get(&item))
        .cloned())
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
    category: String,
    item: String,
    value: SettingsValue,
    data: State<'_, Mutex<AppData>>,
    resource: State<'_, ResourceCache>,
) -> Result<(), String> {
    log::info!("Getting user settings.");

    let mut data = data.lock().map_err(|e| e.to_string())?;

    let default = resource
        .settings
        .get(&category)
        .and_then(|t| t.get(&item))
        .ok_or_else(|| "No settings found.".to_string())?;

    let original = data
        .settings
        .entry(category)
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
        SettingsDefault::Float(_) => match value {
            SettingsValue::Float(val) => *original = SettingsValue::Float(val),
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

// fn export_recursion(storage: &Storage, folder: &FolderId, path: &Path) -> Result<(), AppError> {
//     if let Some(folder) = storage.folders.get(folder) {
//         let folder_path = path.join(&folder.name);
//         let _ = create_dir_all(&folder_path);

//         for asset in &folder.content {
//             if let Some(asset) = storage.assets.get(asset) {
//                 copy(
//                     asset.get_file_path(&storage.cache.root),
//                     folder_path.join(asset.gen_file_name()),
//                 )?;
//             }
//         }

//         for child in &folder.children {
//             export_recursion(storage, child, &folder_path)?;
//         }
//     }

//     Ok(())
// }

// #[tauri::command]
// pub fn export_library(
//     root_folder: PathBuf,
//     storage: State<'_, Mutex<Option<Storage>>>,
// ) -> Result<(), String> {
//     log::info!("Exporting library to {:?}", root_folder);

//     if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
//         export_recursion(&storage, &storage.root_folder, &root_folder).map_err(|e| e.to_string())
//     } else {
//         Err(storage_not_initialized())
//     }
// }

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
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Importing assets {:?}.", path);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.add_assets(path).map_err(|e| e.to_string())?;
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
pub fn import_memory_asset(
    data: Vec<u8>,
    format: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Importing memory asset");

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let duplication = storage
            .add_raw_assets(vec![RawAsset {
                bytes: data,
                ext: format.into(),
                src: Default::default(),
            }])
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;

        Ok(duplication.reduce())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub async fn import_web_assets(
    urls: Vec<String>,
    storage: State<'_, Mutex<Option<Storage>>>,
    progress: Channel<DownloadEvent>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Importing assets from web {:?}.", urls,);

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
        let duplication = storage.add_raw_assets(results).map_err(|e| e.to_string())?;
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
        Ok(storage.recycle_bin.items.clone())
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
pub fn get_tag_virtual_path(
    tag: TagId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<String>, String> {
    log::info!("Getting virtual path of tag {:?}.", tag);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage.get_tag_virtual_path(tag).map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_collection_tree(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<HashMap<CollectionId, Collection>, String> {
    log::info!("Getting collection tree.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .collections
            .clone()
            .into_iter()
            .filter(|(_, c)| !c.is_deleted)
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn get_root_collection_id(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<CollectionId, String> {
    log::info!("Getting root collection id.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.root_collection)
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
    items: Vec<ItemId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Item>, String> {
    log::info!("Getting items {:?}", items);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(items
            .into_iter()
            .filter_map(|id| match id.ty {
                IdType::Asset => storage
                    .assets
                    .get(&id.asset())
                    .cloned()
                    .map(|a| Item::Asset(a)),
                IdType::Collection => storage
                    .collections
                    .get(&id.collection())
                    .cloned()
                    .map(|c| Item::Collection(c)),
                IdType::Tag => storage.tags.get(&id.tag()).cloned().map(|a| Item::Tag(a)),
            })
            .collect())
    } else {
        Err(storage_not_initialized())
    }
}

// #[tauri::command]
// pub fn get_items(
//     items: Vec<Uuid>,
//     storage: State<'_, Mutex<Option<Storage>>>,
// ) -> Result<Vec<Item>, String> {
//     log::info!("Getting items {:?}", items);

//     if let Ok(Some(storage)) = storage.lock().as_deref() {
//         Ok(items
//             .into_iter()
//             .filter_map(|item| {
//                 let asset = storage.assets.get(&AssetId(item));
//                 let folder = storage.folders.get(&FolderId(item));

//                 if asset.is_some() && folder.is_none() {
//                     Some(Item::Asset(asset.unwrap().clone()))
//                 } else if asset.is_none() && folder.is_some() {
//                     Some(Item::Folder(folder.unwrap().clone()))
//                 } else {
//                     None
//                 }
//             })
//             .collect())
//     } else {
//         Err(storage_not_initialized())
//     }
// }

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
            asset.tags = new_tags.clone().into_iter().collect();
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
pub fn delete_tags(
    tags: Vec<TagId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Deleting tags {:?}", tags);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for tag in tags {
            storage.delete_tag(tag).map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn delete_collections(
    collections: Vec<CollectionId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Deleting collections {:?}", collections);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for collection in collections {
            storage
                .delete_collection(collection)
                .map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn create_tags(
    tag_names: Vec<String>,
    parent: CollectionId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Creating tags {:?} in {:?}", tag_names, parent);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for name in tag_names {
            storage
                .create_tag(name, parent)
                .map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn create_collections(
    collection_names: Vec<String>,
    parent: CollectionId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!(
        "Creating collections {:?} in {:?}",
        collection_names,
        parent
    );

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for name in collection_names {
            storage
                .create_collection(name, Color::from_hex_str("FFFFFF").unwrap(), parent)
                .map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn rename_item(
    item: ItemId,
    name: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Renaming item {:?}", item);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        match item.ty {
            IdType::Asset => storage.rename_asset(item.asset(), name),
            IdType::Collection => storage.rename_collection(item.collection(), name),
            IdType::Tag => storage.rename_tag(item.tag(), name),
        }
        .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn move_tags_to(
    src_tags: Vec<TagId>,
    dst_collection: CollectionId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Moving tags {:?} to {:?}", src_tags, dst_collection);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for tag in src_tags {
            if let Err(e) = storage.move_tag_to(tag, dst_collection) {
                return Err(e.to_string());
            }
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn move_collections_to(
    src_collections: Vec<CollectionId>,
    dst_collection: CollectionId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!(
        "Moving collections {:?} to {:?}",
        src_collections,
        dst_collection
    );

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for collection in src_collections {
            if let Err(e) = storage.move_collection_to(collection, dst_collection) {
                return Err(e.to_string());
            }
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn open_with_default_app(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Opening asset {:?} with default app.", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        opener::open(
            storage
                .get_asset_abs_path(asset)
                .map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum QuickRefSrcTy {
    Asset(Vec<AssetId>),
    Tag(TagId),
}

#[tauri::command]
pub async fn quick_ref(
    ty: QuickRefSrcTy,
    storage: State<'_, Mutex<Option<Storage>>>,
    app: AppHandle,
) -> Result<(), String> {
    log::info!("Creating quick refs {:?}", ty);

    let Some(main_window) = app.get_webview_window("main") else {
        return Err("Main window not found.".into());
    };

    let Ok(Some(monitor)) = main_window.current_monitor() else {
        return Err("Monitor not found.".into());
    };
    let screen_resolution = [monitor.size().width, monitor.size().height];

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        let ids: Vec<_> = match &ty {
            QuickRefSrcTy::Asset(ids) => ids.iter().collect(),
            QuickRefSrcTy::Tag(id) => storage
                .assets
                .values()
                .filter_map(|a| a.tags.contains(id).then_some(&a.id))
                .collect(),
        };

        for asset in ids {
            let Some(asset) = storage.assets.get(asset) else {
                return Err(asset_doesnt_exist(*asset));
            };

            let size = asset.props.get_quick_ref_size(screen_resolution);
            let image_like = matches!(
                asset.ty,
                AssetType::RasterGraphics | AssetType::VectorGraphics
            );

            WebviewWindowBuilder::new(
                &app,
                format!("quickref-{}", asset.id.0),
                WebviewUrl::App(format!("quickref/{}", asset.id.0).into()),
            )
            .title(format!("Quick Ref {}", asset.id.0))
            .inner_size(size[0] as f64, size[1] as f64)
            .skip_taskbar(true)
            .always_on_top(true)
            .decorations(!image_like)
            .resizable(!image_like)
            .minimizable(false)
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

#[tauri::command]
pub fn compute_camera_pos(
    y_fov: f32,
    aspect_ratio: f32,
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<[f32; 3], String> {
    log::info!("Computing camera pos for {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        if let Some(asset) = storage.assets.get(&asset) {
            match &asset.props {
                AssetProperty::GltfModel(prop) => {
                    Ok(prop.compute_camera_pos(y_fov, [-1.0, -1.0, -1.0], aspect_ratio))
                }
                _ => Err("Asset is not a model.".into()),
            }
        } else {
            Err(asset_doesnt_exist(asset))
        }
    } else {
        Err(storage_not_initialized())
    }
}

#[tauri::command]
pub fn save_render_cache(
    asset: AssetId,
    base64_data: String,
    camera: GltfPreviewCamera,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Saving render result for {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if let Some(asset) = storage.assets.get_mut(&asset) {
            let file_name = format!("{}.png", asset.id.0);

            match &mut asset.props {
                AssetProperty::GltfModel(prop) => {
                    let engine = base64::engine::GeneralPurpose::new(
                        &base64::alphabet::STANDARD,
                        Default::default(),
                    );
                    write(
                        storage.cache.root.join(CACHE).join(&file_name),
                        engine.decode(base64_data).map_err(|e| e.to_string())?,
                    )
                    .map_err(|e| e.to_string())?;
                    prop.cache_camera = Some(camera);

                    storage.save().map_err(|e| e.to_string())
                }
                _ => Err("Asset is not a model.".into()),
            }
        } else {
            Err(asset_doesnt_exist(asset))
        }
    } else {
        Err(storage_not_initialized())
    }
}

#[derive(Serialize)]
pub struct GltfPreviewCache {
    pub path: PathBuf,
    pub camera: GltfPreviewCamera,
}

#[tauri::command]
pub fn get_render_cache(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Option<GltfPreviewCache>, String> {
    log::info!("Getting render result for {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        if let Some(asset) = storage.assets.get(&asset) {
            match &asset.props {
                AssetProperty::GltfModel(prop) => {
                    Ok(prop.cache_camera.clone().map(|camera| GltfPreviewCache {
                        path: storage
                            .cache
                            .root
                            .join(CACHE)
                            .join(format!("{}.png", asset.id.0)),
                        camera,
                    }))
                }
                _ => Err("Asset is not a model.".into()),
            }
        } else {
            Err(asset_doesnt_exist(asset))
        }
    } else {
        Err(storage_not_initialized())
    }
}
