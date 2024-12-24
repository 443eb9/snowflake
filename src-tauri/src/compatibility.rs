use std::{
    fs::{copy, File},
    path::Path,
    sync::Arc,
};

use hashbrown::{HashMap, HashSet};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::app::{
    AppResult, AssetId, AssetProperty, AssetType, Collection, CollectionId, Color, ItemId,
    LibraryMeta, Metadata, RecycleBin, SpecialCollections, Storage, TagContainer, TagId,
    LIBRARY_STORAGE,
};

pub fn load_legacy_storage(root: impl AsRef<Path>) -> AppResult<Storage> {
    let root_folder = root.as_ref();
    let storage = serde_json::from_reader::<_, LegacyStorage>(File::open(
        root_folder.join(LIBRARY_STORAGE),
    )?)?;
    copy(
        root_folder.join(LIBRARY_STORAGE),
        root_folder.join(format!("{}.bak", LIBRARY_STORAGE)),
    )?;

    let root_collection = CollectionId(storage.root_id.0);
    let sp_collections = SpecialCollections {
        root: root_collection,
    };

    let mut collections = storage
        .folders
        .iter()
        .map(|(id, folder)| {
            (
                id.clone().into(),
                Collection {
                    is_deleted: folder.is_deleted,
                    parent: folder.parent.map(|p| p.into()),
                    id: folder.id.into(),
                    name: folder.name.clone(),
                    color: None,
                    meta: folder.meta.clone(),
                    content: Default::default(),
                    children: folder
                        .children
                        .clone()
                        .into_iter()
                        .map(Into::into)
                        .collect(),
                },
            )
        })
        .collect::<HashMap<_, _>>();

    let mut folder_tags = storage
        .folders
        .values()
        .map(|c| {
            (
                c.id.into(),
                crate::app::Tag::new(
                    c.name.clone(),
                    c.parent.map(|p| p.into()).unwrap_or(root_collection).into(),
                ),
            )
        })
        .collect::<HashMap<CollectionId, crate::app::Tag>>();

    let mut tags = storage
        .tags
        .into_iter()
        .map(|(id, tag)| {
            (
                id,
                crate::app::Tag {
                    is_deleted: false,
                    parent: storage.root_id.into(),
                    group: None,
                    id: tag.id,
                    name: tag.name,
                    color: None,
                    meta: tag.meta,
                },
            )
        })
        .chain(folder_tags.values().map(|t| (t.id, t.clone())))
        .collect::<HashMap<TagId, crate::app::Tag>>();

    for tag in folder_tags.values_mut() {
        collections
            .get_mut(&tag.parent)
            .unwrap()
            .content
            .insert(tag.id);
        tag.group = Some(tag.parent);
    }

    for collection in collections.values_mut() {
        if collection.content.is_empty() || collection.id == sp_collections.root {
            continue;
        }
        collection.color = Some(Color::random());

        for content in &collection.content {
            tags.get_mut(content).unwrap().color = collection.color;
        }
    }

    let mut storage = Storage {
        cache: Default::default(),
        sp_collections,
        tags,
        assets: storage
            .assets
            .into_iter()
            .map(|(id, asset)| {
                (
                    id,
                    crate::app::Asset {
                        is_deleted: false,
                        id: asset.id,
                        name: asset.name,
                        ty: asset.ty,
                        ext: asset.ext,
                        props: asset.props,
                        meta: asset.meta,
                        tags: TagContainer {
                            grouped: HashMap::from([(
                                CollectionId(asset.parent.0),
                                folder_tags[&CollectionId(asset.parent.0)].id,
                            )]),
                            ungrouped: asset.tags.into_iter().collect(),
                        },
                        src: asset.src,
                    },
                )
            })
            .collect(),
        recycle_bin: RecycleBin {
            assets: Default::default(),
            collections: storage
                .folders
                .values()
                .filter(|f| f.is_deleted)
                .map(|f| f.id.into())
                .collect(),
            tags: Default::default(),
        },
        lib_meta: storage.lib_meta,
        collections: collections.into_iter().collect(),
    };

    let removed = storage
        .collections
        .values()
        .filter(|c| c.children.is_empty() && c.content.is_empty())
        .map(|c| c.id)
        .collect::<HashSet<_>>();
    storage.collections = storage
        .collections
        .into_iter()
        .filter(|c| !removed.contains(&c.0))
        .collect();
    for collection in storage.collections.values_mut() {
        collection.children = collection
            .children
            .clone()
            .into_iter()
            .filter(|c| !removed.contains(c))
            .collect();
    }

    Ok(storage)
}

#[derive(Serialize, Deserialize, Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct FolderId(pub Uuid);

impl Into<CollectionId> for FolderId {
    fn into(self) -> CollectionId {
        CollectionId(self.0)
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyStorage {
    pub root_id: FolderId,
    pub tags: HashMap<TagId, Tag>,
    pub folders: HashMap<FolderId, Folder>,
    pub assets: HashMap<AssetId, Asset>,
    pub recycle_bin: HashSet<ItemId>,
    pub lib_meta: LibraryMeta,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Folder {
    pub is_deleted: bool,
    pub parent: Option<FolderId>,
    pub id: FolderId,
    pub name: String,
    pub children: HashSet<FolderId>,
    pub content: HashSet<AssetId>,
    pub meta: Metadata,
    pub tags: Vec<TagId>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Asset {
    pub parent: FolderId,
    pub id: AssetId,
    pub name: String,
    pub ty: AssetType,
    pub ext: Arc<str>,
    pub props: AssetProperty,
    pub meta: Metadata,
    pub tags: Vec<TagId>,
    pub src: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    pub id: TagId,
    pub name: String,
    pub color: Color,
    pub meta: Metadata,
}
