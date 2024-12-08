use std::{path::PathBuf, sync::Mutex};

use chrono::Local;
use futures::StreamExt;
use hashbrown::{HashMap, HashSet};
use reqwest::Client;
use serde::Deserialize;
use tauri::{ipc::Channel, AppHandle, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::{
    app::{
        AppData, Asset, AssetId, AssetProperty, Checksums, Folder, FolderId, RawAsset, RecentLib,
        SettingsValue, Storage, Tag, TagId, UserSettings,
    },
    err::{asset_doesnt_exist, folder_doesnt_exist, storage_not_initialized},
    event::{DownloadEvent, DownloadStatus},
};

#[tauri::command]
pub fn get_recent_libraries(data: State<'_, Mutex<AppData>>) -> Result<Vec<RecentLib>, String> {
    let data = data.lock().map_err(|e| e.to_string())?;
    Ok(data.recent_libs.values().cloned().collect())
}

#[tauri::command]
pub fn get_user_settings(data: State<'_, Mutex<AppData>>) -> Result<UserSettings, String> {
    let data = data.lock().map_err(|e| e.to_string())?;
    Ok(data.settings.clone())
}

#[derive(Deserialize)]
#[serde(untagged)]
pub enum SettingsUpdate {
    Toggle(bool),
    Value(String),
    Sequence(Vec<String>),
}

#[tauri::command]
pub fn set_user_setting(
    tab: String,
    item: String,
    value: SettingsUpdate,
    data: State<'_, Mutex<AppData>>,
) -> Result<(), String> {
    let mut data = data.lock().map_err(|e| e.to_string())?;

    let item = data
        .settings
        .get_mut(&tab)
        .and_then(|t| t.get_mut(&item))
        .ok_or_else(|| "No settings found.".to_string())?;

    match item {
        SettingsValue::Toggle(b) => match value {
            SettingsUpdate::Toggle(nb) => *b = nb,
            _ => return Err("Incompatible value".into()),
        },
        SettingsValue::Sequence(seq) => match value {
            SettingsUpdate::Sequence(s) => *seq = s,
            _ => return Err("Incompatible value".into()),
        },
        SettingsValue::Selection { selected, possible } => match value {
            SettingsUpdate::Value(v) => {
                if possible.contains(&v) {
                    *selected = v
                } else {
                    return Err("Incompatible value".into());
                }
            }
            _ => return Err("Incompatible value".into()),
        },
        SettingsValue::Custom(s) => match value {
            SettingsUpdate::Value(v) => *s = v,
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
    data.save(&app).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn initialize_library(
    src_root_folder: PathBuf,
    root_folder: PathBuf,
    storage: State<'_, Mutex<Option<Storage>>>,
    data: State<'_, Mutex<AppData>>,
    app: AppHandle,
) -> Result<(), String> {
    log::info!("Start initializing library at {:?}", root_folder);

    let new_storage =
        Storage::from_constructed(&src_root_folder, &root_folder).map_err(|e| e.to_string())?;
    new_storage.save().map_err(|e| e.to_string())?;

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
    data.save(&app).map_err(|e| e.to_string())?;

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
        storage
            .add_assets(path, parent)
            .map_err(|e| e.to_string())?;
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
) -> Result<(), String> {
    log::info!(
        "Importing assets from web {:?} into folder {:?}.",
        urls,
        parent
    );

    let client = Client::new();
    let mut results = Vec::with_capacity(urls.len());

    for (index, url) in urls.into_iter().enumerate() {
        let id = index as u32;
        let request = match client.get(url).build() {
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

                let content_ty = ok
                    .headers()
                    .get("content-type")
                    .and_then(|t| t.to_str().ok())
                    .map(|e| e.to_string());

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

                results.push(RawAsset {
                    bytes: content,
                    ext: content_ty
                        .map(|t| {
                            let mut s = t.split('/');
                            s.next();
                            s.next().unwrap_or_default().to_string()
                        })
                        .unwrap_or_default()
                        .into(),
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
        storage
            .add_raw_assets(results, parent)
            .map_err(|e| e.to_string())
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

        let asset = asset.clone();
        storage.save().map_err(|e| e.to_string())?;
        Ok(asset)
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

        storage.save().map_err(|e| e.to_string())
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

            let Some(AssetProperty::Image(properties)) = &asset.props else {
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

        storage.save().map_err(|e| e.to_string())
    } else {
        Err(storage_not_initialized())
    }
}
