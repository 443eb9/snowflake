import { Channel, invoke } from "@tauri-apps/api/core";

export type Selectable = { default: string, candidates: string[] }

export type SettingsValue = string | string[] | boolean | number

export type UserSettings = { [category: string]: { [item: string]: SettingsValue } }

export type DefaultSettings = { [category: string]: { [item: string]: SettingsValue & Selectable } }

export type DownloadEvent = {
    id: number,
    downloaded: number,
    total: number | undefined,
    status: string | { Error: string },
}

export type LibraryMeta = {
    name: string,
    meta: Metadata,
}

export type Collection = {
    parent: string | null,
    id: string,
    name: string,
    children: string[],
    content: string[],
    meta: Metadata,
    color: string,
}

export type AssetProperty = {
    width: number,
    height: number,
} | {
    width: number,
    height: number,
    aspect: number,
} | {
    min: [number, number, number],
    max: [number, number, number],
    size: [number, number, number],
    triangles: number,
    vertices: number,
}

export type Asset = {
    parent: string,
    id: string,
    name: string,
    ty: AssetType,
    props: AssetProperty,
    ext: string,
    meta: Metadata,
    src: string,
}

export type Tag = {
    id: string,
    name: string,
    color: string | null,
    meta: Metadata,
    parent: string,
}

export type Metadata = {
    byteSize: number,
    createdAt: string,
    lastModified: string,
}

export type AssetType = "rasterGraphics" | "vectorGraphics" | "gltfModel"

export type DuplicateAssets = { [key: string]: string[] }

export type RecentLib = {
    path: string,
    name: string,
    lastOpen: string,
}

export type QuickRefSrcTy = {
    asset: string[],
} | {
    folder: string,
} | {
    tag: string,
}

export type LibraryStatistics = {
    totalAssets: number,
    assetExt: { [ext: string]: number },
}

export type Item = {
    asset: Asset,
} | {
    collection: Collection,
} | {
    tag: Tag,
}

export type SpecialCollections = {
    root: string,
}

export type ItemTy = "asset" | "collection" | "tag"

export type ItemId = {
    id: string,
    ty: ItemTy,
}

export type GltfPreviewCamera = {
    pos: [number, number, number],
    rot: [number, number, number, number],
}

export type GltfPreviewCache = {
    path: string,
    camera: GltfPreviewCamera,
}

export type CollectionDesc = {
    name: string,
    color: string,
}

export type StorageConstructionSettings = {
    srcRoot: string,
    root: string,
    folderAsTag: boolean,
}

export function CrashTest(): Promise<void> {
    return invoke("crash_test")
}

export function GetProcessDir(): Promise<string> {
    return invoke("get_process_dir")
}

export function GetRecentLibs(): Promise<RecentLib[]> {
    return invoke("get_recent_libraries")
}

export function GetUserSettings(): Promise<UserSettings> {
    return invoke("get_user_settings")
}

export function GetUserSetting(params: { category: string, item: string }): Promise<SettingsValue | undefined> {
    return invoke("get_user_setting", params)
}

export function GetLibraryMeta(): Promise<LibraryMeta> {
    return invoke("get_library_meta")
}

export function GetLibraryStatistics(): Promise<LibraryStatistics> {
    return invoke("gen_statistics")
}

export function GetDefaultSettings(): Promise<DefaultSettings> {
    return invoke("get_default_settings")
}

export function SetUserSetting(params: { category: string, item: string, value: SettingsValue }): Promise<void> {
    return invoke("set_user_setting", params)
}

export function LoadLibrary(params: { rootFolder: string }): Promise<DuplicateAssets | undefined> {
    return invoke("load_library", params)
}

export function InitializeLibrary(params: { settings: StorageConstructionSettings }): Promise<DuplicateAssets | undefined> {
    return invoke("initialize_library", params)
}

export function SaveLibrary(): Promise<void> {
    return invoke("save_library")
}

export function UnloadLibrary(): Promise<void> {
    return invoke("unload_library")
}

export function ExportLibrary(params: { rootFolder: string }): Promise<void> {
    return invoke("export_library", params)
}

export function GenStatistics(): Promise<LibraryStatistics> {
    return invoke("gen_statistics")
}

export function RecoverAssets(params: { assets: string[] }): Promise<void> {
    return invoke("recover_assets", params)
}

export function GetRecycleBin(): Promise<ItemId[]> {
    return invoke("get_recycle_bin")
}

export function GetDuplicatedAssets(): Promise<DuplicateAssets> {
    return invoke("get_duplicated_assets")
}

export function ChangeLibraryName(params: { name: string }): Promise<DuplicateAssets | undefined> {
    return invoke("change_library_name", params)
}

export function ImportAssets(params: { path: string[], initialTag: string | null }): Promise<DuplicateAssets | undefined> {
    return invoke("import_assets", params)
}

export function ImportMemoryAssets(params: { data: Uint8Array, format: string, initialTag: string | null }): Promise<DuplicateAssets | undefined> {
    return invoke("import_memory_asset", params)
}

export function ImportWebAssets(params: { urls: string[], initialTag: string | null, progress: Channel<DownloadEvent> }): Promise<DuplicateAssets | undefined> {
    return invoke("import_web_assets", params)
}

export function GetAssetAbsPath(params: { asset: string }): Promise<string> {
    return invoke("get_asset_abs_path", params)
}

export function GetTagVirtualPath(params: { tag: string }): Promise<string[]> {
    return invoke("get_tag_virtual_path", params)
}

export async function GetCollectionTree(params: { noSpecial: boolean }): Promise<Map<string, Collection>> {
    return invoke("get_collection_tree", params)
        .then(map => new Map(Object.entries(map as { [s: string]: Collection; })))
}

export function GetSpecialCollections(): Promise<SpecialCollections> {
    return invoke("get_special_collections")
}

export function GetAllTags(): Promise<Tag[]> {
    return invoke("get_all_tags")
}

export function GetAllAssets(): Promise<string[]> {
    return invoke("get_all_assets")
}

export function GetAllUncategorizedAssets(): Promise<string[]> {
    return invoke("get_all_uncategorized_assets")
}

export function GetAsset(params: { asset: string }): Promise<Asset> {
    return invoke("get_asset", params)
}

export function GetRemovedAsset(params: { asset: string }): Promise<Asset> {
    return invoke("get_removed_asset", params)
}

export function GetAssets(params: { assets: string[] }): Promise<Asset[]> {
    return invoke("get_assets", params)
}

export function GetTagsOnAsset(params: { asset: string }): Promise<string[]> {
    return invoke("get_tags_on_asset", params)
}

export function ModifySrcOf(params: { asset: string, src: string }): Promise<void> {
    return invoke("modify_src_of", params)
}

export function GetTags(params: { tags: string[] }): Promise<Tag[]> {
    return invoke("get_tags", params)
}

export function GetItems(params: { items: ItemId[] }): Promise<Item[]> {
    return invoke("get_items", params)
}

export function AddTagToAssets(params: { assets: string[], tag: string }): Promise<void> {
    return invoke("add_tag_to_assets", params)
}

export function RemoveTagFromAssets(params: { assets: string[], tag: string }): Promise<void> {
    return invoke("remove_tag_from_assets", params)
}

export function GetAssetsContainingTag(params: { tag: string }): Promise<string[]> {
    return invoke("get_assets_containing_tag", params)
}

export function DeleteAssets(params: { assets: string[], permanently: boolean }): Promise<void> {
    return invoke("delete_assets", params)
}

export function DeleteCollections(params: { collections: string[] }): Promise<void> {
    return invoke("delete_collections", params)
}

export function DeleteTags(params: { tags: string[] }): Promise<void> {
    return invoke("delete_tags", params)
}

export function CreateTags(params: { tagNames: string[], parent: string }): Promise<void> {
    return invoke("create_tags", params)
}

export function CreateCollections(params: { collectionNames: string[], parent: string }): Promise<void> {
    return invoke("create_collections", params)
}

export function RenameItem(params: { item: ItemId, name: string }): Promise<void> {
    return invoke("rename_item", params)
}

export function RecolorCollection(params: { collection: string, color: string | null }): Promise<void> {
    return invoke("recolor_collection", params)
}

export function MoveCollectionsTo(params: { srcCollections: string[], dstCollection: string }): Promise<void> {
    return invoke("move_collections_to", params)
}

export function MoveTagsTo(params: { srcTags: string[], dstCollection: string }): Promise<void> {
    return invoke("move_tags_to", params)
}

export function RegroupTag(params: { tag: string, group: string | null }): Promise<void> {
    return invoke("regroup_tag", params)
}

export function OpenWithDefaultApp(params: { asset: string }): Promise<void> {
    return invoke("open_with_default_app", params)
}

export function QuickRef(params: { ty: QuickRefSrcTy }): Promise<void> {
    return invoke("quick_ref", params)
}

export function ComputeCameraPos(params: { yFov: number, aspectRatio: number, asset: string }): Promise<[number, number, number]> {
    return invoke("compute_camera_pos", params)
}

export function SaveRenderCache(params: { asset: string, base64Data: string, camera: GltfPreviewCamera }): Promise<string | undefined> {
    return invoke("save_render_cache", params)
}

export function GetRenderCache(params: { asset: string }): Promise<GltfPreviewCache | undefined> {
    return invoke("get_render_cache", params)
}
