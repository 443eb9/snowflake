use std::{
    fs::{copy, create_dir_all, write},
    path::PathBuf,
    sync::Mutex,
};

use base64::Engine;
use chrono::Local;
use file_format::{FileFormat, Kind};
use futures::StreamExt;
use hashbrown::{HashMap, HashSet};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{ipc::Channel, AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::{
    app::{
        AppData, AppError, Asset, AssetId, AssetProperty, AssetType, Collection, CollectionId,
        Color, DuplicateAssets, GltfPreviewCamera, IdType, Item, ItemId, ItemIds, LibraryMeta,
        LibraryStatistics, RawAsset, RecentLib, ResourceCache, SettingsDefault, SpecialCollections,
        Storage, StorageConstructionSettings, Tag, TagId, UserSettings, CACHE,
    },
    event::{DownloadEvent, DownloadStatus},
};

#[tauri::command]
pub fn crash_test() {
    panic!("Oops.")
}

#[tauri::command]
pub fn open_crash_reports_dir(app: AppHandle) -> Result<(), String> {
    log::info!("Opening crash reports dir.");

    tauri_plugin_opener::open_path(
        app.path().app_data_dir().map_err(|e| e.to_string())?,
        None::<&str>,
    )
    .map_err(|e| e.to_string())
}

#[derive(Serialize, Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum WindowTransparency {
    None,
    Blur,
    Acrylic,
    Mica,
    Tabbed,
    Vibrancy,
}

#[tauri::command]
pub fn set_window_transparency(
    window_label: Option<String>,
    new_transparency: Option<WindowTransparency>,
    new_color: Option<(f32, f32, f32, f32)>,
    app: AppHandle,
    data: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    log::info!(
        "Setting window transparency {:?} {:?} to {:?}",
        &new_transparency,
        new_color,
        window_label
    );

    let window = match window_label {
        Some(label) => app.get_webview_window(&label),
        None => app.get_webview_window("main"),
    }
    .ok_or_else(|| "Window not found".to_string())?;
    let data = data.lock().map_err(|e| e.to_string())?;
    let old_transparency = data
        .settings
        .get_as::<WindowTransparency>("appearance", "transparency")
        .ok_or_else(|| "Invalid user settings".to_string())?;
    let old_color = data
        .settings
        .get_as::<(f32, f32, f32, f32)>("appearance", "transparencyColor")
        .ok_or_else(|| "Invalid user settings".to_string())?;

    if new_transparency.is_some() {
        let _ = match old_transparency {
            WindowTransparency::None => Ok(()),
            WindowTransparency::Blur => window_vibrancy::clear_blur(&window),
            WindowTransparency::Acrylic => window_vibrancy::clear_acrylic(&window),
            WindowTransparency::Mica => window_vibrancy::clear_mica(&window),
            WindowTransparency::Tabbed => window_vibrancy::clear_tabbed(&window),
            WindowTransparency::Vibrancy => Ok(()),
        };
    }

    let new_transparency = new_transparency.unwrap_or(old_transparency);
    let new_color = new_color.unwrap_or(old_color);
    let adapted_color = Some((
        new_color.0 as u8,
        new_color.1 as u8,
        new_color.2 as u8,
        (new_color.3 * 255.0) as u8,
    ));

    match new_transparency {
        WindowTransparency::None => Ok(()),
        WindowTransparency::Blur => window_vibrancy::apply_blur(&window, adapted_color),
        WindowTransparency::Acrylic => window_vibrancy::apply_acrylic(&window, adapted_color),
        WindowTransparency::Mica => window_vibrancy::apply_mica(&window, Some(true)),
        WindowTransparency::Tabbed => window_vibrancy::apply_tabbed(&window, Some(true)),
        WindowTransparency::Vibrancy => window_vibrancy::apply_vibrancy(
            &window,
            window_vibrancy::NSVisualEffectMaterial::WindowBackground,
            None,
            None,
        ),
    }
    .map_err(|e| e.to_string())?;

    Ok(())
}

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
) -> Result<Value, String> {
    log::info!("Getting user setting. {} {}", category, item);

    let data = data.lock().map_err(|e| e.to_string())?;
    data.settings
        .get(&category, &item)
        .cloned()
        .ok_or_else(|| AppError::SettingNotFound(category, item).to_string())
}

#[tauri::command]
pub fn get_library_meta(storage: State<'_, Mutex<Option<Storage>>>) -> Result<LibraryMeta, String> {
    log::info!("Getting library meta.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.lib_meta.clone())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
pub fn get_default_setting(
    category: String,
    item: String,
    data: State<'_, ResourceCache>,
) -> Result<SettingsDefault, String> {
    log::info!("Getting default setting {} {}.", category, item);
    data.settings
        .get(&category)
        .and_then(|c| c.get(&item))
        .cloned()
        .ok_or_else(|| "No such setting.".to_string())
}

#[tauri::command]
pub fn set_user_setting(
    category: String,
    item: String,
    value: Value,
    data: State<'_, Mutex<AppData>>,
    resource: State<'_, ResourceCache>,
    app: AppHandle,
) -> Result<(), String> {
    log::info!("Setting user setting {} {} {:?}.", category, item, value);

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
        SettingsDefault::Selection { candidates, .. } => {
            let Value::String(new) = value else {
                return Err(AppError::IncompatibleSettingValue.to_string());
            };
            if candidates.contains(&new) {
                *original = Value::String(new);
            } else {
                return Err(AppError::IncompatibleSettingValue.to_string());
            }
        }
        SettingsDefault::Value(default) => {
            if std::mem::discriminant(default) == std::mem::discriminant(&original) {
                *original = value;
            } else {
                return Err(AppError::IncompatibleSettingValue.to_string());
            }
        }
    }

    data.save(app.app_handle()).map_err(|e| e.to_string())?;

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
    settings: StorageConstructionSettings,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
    app: AppHandle,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Start initializing library {:?}", settings);

    let mut new_storage = Storage::from_constructed(settings.clone()).map_err(|e| e.to_string())?;
    new_storage.save().map_err(|e| e.to_string())?;

    let mut data = data.lock().map_err(|e| e.to_string())?;
    data.recent_libs.insert(
        settings.root.clone(),
        RecentLib {
            name: new_storage.lib_meta.name.clone(),
            path: settings.root.clone(),
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

fn export_recursion(
    storage: &Storage,
    collection: CollectionId,
    path: PathBuf,
    tag_to_path: &mut HashMap<TagId, PathBuf>,
) -> Result<(), AppError> {
    if let Some(collection) = storage.collections.get(&collection) {
        let collection_path = path.join(collection.name.as_ref());
        let _ = create_dir_all(&collection_path);

        for tag in &collection.content {
            let Some(tag) = storage.tags.get(tag) else {
                return Err(AppError::TagNotFound(*tag));
            };
            let _ = create_dir_all(&collection_path.join(tag.name.as_ref()));
            tag_to_path.insert(tag.id, collection_path.join(tag.name.as_ref()));
        }

        for child in collection.children.clone() {
            export_recursion(storage, child, collection_path.clone(), tag_to_path)?;
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
        let mut tag_to_path = HashMap::default();
        export_recursion(
            storage,
            storage.sp_collections.root,
            root_folder.join(&storage.lib_meta.name),
            &mut tag_to_path,
        )
        .map_err(|e| e.to_string())?;

        for asset in storage.assets.values() {
            let asset_path = asset.get_file_path(&storage.cache.root);

            for tag in asset.tags.grouped.values().chain(&asset.tags.ungrouped) {
                if let Some(path) = tag_to_path.get(tag) {
                    copy(&asset_path, path.join(asset.gen_file_name().as_ref()))
                        .map_err(|e| e.to_string())?;
                } else {
                    return Err(AppError::TagNotFound(*tag).to_string());
                }
            }
        }

        Ok(())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn import_assets(
    initial_tag: Option<TagId>,
    path: Vec<PathBuf>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Importing assets {:?} to {:?}.", path, initial_tag);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let duplication = storage
            .add_assets(initial_tag, path)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;
        Ok(duplication.reduce())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn import_memory_asset(
    initial_tag: Option<TagId>,
    data: Vec<u8>,
    format: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Importing memory asset");

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let duplication = storage
            .add_raw_assets(
                initial_tag,
                vec![RawAsset {
                    bytes: data,
                    ext: format.into(),
                    src: Default::default(),
                }],
            )
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;

        Ok(duplication.reduce())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub async fn import_web_assets(
    initial_tag: Option<TagId>,
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
                            "Failed to import unsupported asset. {}",
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
        let duplication = storage
            .add_raw_assets(initial_tag, results)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;
        Ok(duplication.reduce())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn recover_items(
    items: Vec<ItemId>,
    parent_override: Option<CollectionId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Option<DuplicateAssets>, String> {
    log::info!("Recovering items {:?} -> {:?}", items, parent_override);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        let mut assets = Vec::with_capacity(items.len());
        let mut collections = Vec::with_capacity(items.len());
        let mut tags = Vec::with_capacity(items.len());
        for item in items {
            match item {
                ItemId::Asset(a) => assets.push(a),
                ItemId::Collection(c) => collections.push(c),
                ItemId::Tag(t) => tags.push(t),
            }
        }

        let duplication = storage.recover_assets(assets).map_err(|e| e.to_string())?;
        storage
            .recover_collections(collections, parent_override)
            .map_err(|e| e.to_string())?;
        storage
            .recover_tags(tags, parent_override)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())?;
        Ok(duplication.reduce())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_recycle_bin(
    ty: IdType,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<ItemIds, String> {
    log::info!("Getting recycle bin {:?}.", ty);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(match ty {
            IdType::Asset => {
                ItemIds::Asset(storage.recycle_bin.assets.clone().into_iter().collect())
            }
            IdType::Collection => ItemIds::Collection(
                storage
                    .recycle_bin
                    .collections
                    .clone()
                    .into_iter()
                    .collect(),
            ),
            IdType::Tag => ItemIds::Tag(storage.recycle_bin.tags.clone().into_iter().collect()),
        })
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_collection_tree(
    no_special: bool,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<HashMap<CollectionId, Collection>, String> {
    log::info!("Getting collection tree.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        let mut collections = storage.collections.clone();
        if no_special {
            collections.remove(&storage.sp_collections.root);
        }
        Ok(collections
            .into_iter()
            .filter(|(_, c)| !c.is_deleted)
            .collect())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_special_collections(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<SpecialCollections, String> {
    log::info!("Getting special collections.");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage.sp_collections)
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_all_tags(storage: State<'_, Mutex<Option<Storage>>>) -> Result<Vec<Tag>, String> {
    log::info!("Getting all tags");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .tags
            .values()
            .filter(|t| !t.is_deleted)
            .cloned()
            .collect())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_all_assets(storage: State<'_, Mutex<Option<Storage>>>) -> Result<Vec<AssetId>, String> {
    log::info!("Getting all assets");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .assets
            .values()
            .filter(|a| !a.is_deleted)
            .map(|a| a.id)
            .collect())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_all_uncategorized_assets(
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<AssetId>, String> {
    log::info!("Getting all uncategorized assets");

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(storage
            .assets
            .values()
            .filter(|a| !a.is_deleted && a.tags.is_empty())
            .map(|a| a.id)
            .collect())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn modify_tag(new_tag: Tag, storage: State<'_, Mutex<Option<Storage>>>) -> Result<(), String> {
    log::info!("Modifying tag: {:?}", new_tag);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage.tags.insert(new_tag.id, new_tag);
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_item(item: ItemId, storage: State<'_, Mutex<Option<Storage>>>) -> Result<Item, String> {
    log::info!("Getting item {:?}", item);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(match item {
            ItemId::Asset(asset) => Item::Asset(
                storage
                    .assets
                    .get(&asset)
                    .cloned()
                    .ok_or_else(|| AppError::AssetNotFound(asset).to_string())?,
            ),
            ItemId::Collection(collection) => Item::Collection(
                storage
                    .collections
                    .get(&collection)
                    .cloned()
                    .ok_or_else(|| AppError::CollectionNotFound(collection).to_string())?,
            ),
            ItemId::Tag(tag) => Item::Tag(
                storage
                    .tags
                    .get(&tag)
                    .cloned()
                    .ok_or_else(|| AppError::TagNotFound(tag).to_string())?,
            ),
        })
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_tags_on_asset(
    asset: AssetId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<TagId>, String> {
    log::info!("Getting tags on asset {:?}", asset);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        if let Some(asset) = storage.assets.get(&asset) {
            Ok(asset.tags.clone().into())
        } else {
            Err(AppError::AssetNotFound(asset).to_string())
        }
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum FilterStrategy {
    All,
    UnremovedOnly,
    RemovedOnly,
}

#[tauri::command]
pub fn get_items(
    items: Vec<ItemId>,
    filter: FilterStrategy,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Item>, String> {
    log::info!("Getting items {:?}", items);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        let all = items.into_iter().filter_map(|id| match id {
            ItemId::Asset(a) => storage.assets.get(&a).cloned().map(|a| Item::Asset(a)),
            ItemId::Collection(c) => storage
                .collections
                .get(&c)
                .cloned()
                .map(|c| Item::Collection(c)),
            ItemId::Tag(t) => storage.tags.get(&t).cloned().map(|a| Item::Tag(a)),
        });

        match filter {
            FilterStrategy::All => Ok(all.collect()),
            FilterStrategy::UnremovedOnly => Ok(all.filter(|i| !i.is_deleted()).collect()),
            FilterStrategy::RemovedOnly => Ok(all.filter(Item::is_deleted).collect()),
        }
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_tags_without_conflict(
    tags: Vec<TagId>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<Tag>, String> {
    log::info!("Getting tags without conflict {:?}", tags);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        let tags = tags
            .iter()
            .filter_map(|id| storage.tags.get(id))
            .filter(|tag| !tag.is_deleted)
            .collect::<Vec<_>>();
        let conflict_groups = tags
            .iter()
            .filter_map(|tag| tag.group)
            .collect::<HashSet<_>>();
        let conflict_ungrouped = tags
            .iter()
            .filter_map(|tag| tag.group.is_none().then_some(tag.id))
            .collect::<HashSet<_>>();

        Ok(storage
            .tags
            .values()
            .filter(|tag| !tag.is_deleted)
            .filter(|tag| match &tag.group {
                Some(group) => !conflict_groups.contains(group),
                None => !conflict_ungrouped.contains(&tag.id),
            })
            .cloned()
            .collect())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn add_tag_to_assets(
    assets: Vec<AssetId>,
    tag: TagId,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    log::info!("Adding tag to assets {:?} -> {:?}", tag, assets);

    let data = data.lock().map_err(|e| e.to_string())?;
    let resolve = data
        .settings
        .get_as("general", "tagGroupConflictResolve")
        .unwrap();
    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for asset in assets {
            storage
                .add_tag_to_asset(asset, tag, resolve)
                .map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn remove_tag_from_assets(
    assets: Vec<AssetId>,
    tag: TagId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Removing tag from assets {:?} <- {:?}", tag, assets);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        for asset in assets {
            storage
                .remove_tag_from_asset(asset, tag)
                .map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn get_assets_containing_tag(
    tag: TagId,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<Vec<AssetId>, String> {
    log::info!("Getting assets containing tag {:?}", tag);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        storage
            .get_assets_containing_tag(tag)
            .map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
            Err(AppError::AssetNotFound(asset).to_string())
        }
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn delete_items(
    items: Vec<ItemId>,
    permanently: bool,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Deleting items {:?}, permanently: {}", items, permanently);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if permanently {
            for item in items {
                match item {
                    ItemId::Asset(a) => storage.delete_asset(a),
                    ItemId::Collection(c) => storage.delete_collection(c),
                    ItemId::Tag(t) => storage.delete_tag(t),
                }
                .map_err(|e| e.to_string())?;
            }
        } else {
            for item in items {
                match item {
                    ItemId::Asset(a) => storage.move_asset_to_recycle_bin(a),
                    ItemId::Collection(c) => storage.move_collection_to_recycle_bin(c),
                    ItemId::Tag(t) => storage.move_tag_to_recycle_bin(t),
                }
                .map_err(|e| e.to_string())?;
            }
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
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
                .create_collection(name, parent)
                .map_err(|e| e.to_string())?;
        }

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn recolor_collection(
    collection: CollectionId,
    color: Option<Color>,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<(), String> {
    log::info!("Recoloring collections {:?} into {:?}", collection, color);

    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        if storage.sp_collections.is_special(collection) {
            return Err(AppError::IllegalCollectionModification(collection).to_string());
        }

        storage
            .recolor_collection(collection, color)
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        match item {
            ItemId::Asset(a) => storage.rename_asset(a, name),
            ItemId::Collection(c) => storage.rename_collection(c, name),
            ItemId::Tag(t) => storage.rename_tag(t, name),
        }
        .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[tauri::command]
pub fn regroup_tag(
    tag: TagId,
    group: Option<CollectionId>,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    log::info!("Regrouping tag {:?} to {:?}", tag, group);

    let data = data.lock().map_err(|e| e.to_string())?;
    if let Ok(Some(storage)) = storage.lock().as_deref_mut() {
        storage
            .regroup_tag(
                tag,
                group,
                data.settings
                    .get_as("general", "tagGroupConflictResolve")
                    .unwrap(),
            )
            .map_err(|e| e.to_string())?;
        storage.save().map_err(|e| e.to_string())
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
    }
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub enum SearchQueryTy {
    AssetId,
    AssetName,
    TagId,
    TagName,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
#[serde(tag = "ty", content = "data")]
pub enum SearchQueryResult {
    Assets(Vec<Asset>),
    Tags(Vec<Tag>),
}

#[tauri::command]
pub async fn global_search(
    ty: SearchQueryTy,
    query: String,
    storage: State<'_, Mutex<Option<Storage>>>,
) -> Result<SearchQueryResult, String> {
    log::info!("Global searching {:?} {}", ty, query);

    if let Ok(Some(storage)) = storage.lock().as_deref() {
        Ok(match ty {
            SearchQueryTy::AssetId => SearchQueryResult::Assets(
                storage
                    .assets
                    .iter()
                    .filter(|(_, asset)| !asset.is_deleted)
                    .filter(|(id, _)| id.0.to_string().contains(&query))
                    .map(|(_, asset)| asset.clone())
                    .collect(),
            ),
            SearchQueryTy::AssetName => SearchQueryResult::Assets(
                storage
                    .assets
                    .values()
                    .filter(|asset| !asset.is_deleted && asset.name.contains(&query))
                    .cloned()
                    .collect(),
            ),
            SearchQueryTy::TagId => SearchQueryResult::Tags(
                storage
                    .tags
                    .iter()
                    .filter(|(id, _)| id.0.to_string().contains(&query))
                    .map(|(_, tag)| tag.clone())
                    .collect(),
            ),
            SearchQueryTy::TagName => SearchQueryResult::Tags(
                storage
                    .tags
                    .values()
                    .filter(|tag| &tag.name.contains(&query))
                    .cloned()
                    .collect(),
            ),
        })
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
        Err(AppError::StorageNotInitialized.to_string())
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
            QuickRefSrcTy::Asset(ids) => ids.clone(),
            QuickRefSrcTy::Tag(id) => storage
                .get_assets_containing_tag(*id)
                .map_err(|e| e.to_string())?,
        };

        for asset in ids {
            let Some(asset) = storage.assets.get(&asset) else {
                return Err(AppError::AssetNotFound(asset).to_string());
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
        Err(AppError::StorageNotInitialized.to_string())
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
            Err(AppError::AssetNotFound(asset).to_string())
        }
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
            Err(AppError::AssetNotFound(asset).to_string())
        }
    } else {
        Err(AppError::StorageNotInitialized.to_string())
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
            Err(AppError::AssetNotFound(asset).to_string())
        }
    } else {
        Err(AppError::StorageNotInitialized.to_string())
    }
}
