import { Channel, invoke } from "@tauri-apps/api/core";

export type Selectable = { default: string, candidates: string[] }

export type SettingsValue = string | string[] | boolean

export type UserSettings = { [category: string]: { [item: string]: SettingsValue } }

export type DefaultSettings = { [category: string]: { [item: string]: SettingsValue & Selectable } }

export type DownloadEvent = {
    id: number,
    downloaded: number,
    total: number | undefined,
    status: string | { Error: string },
}

export type Folder = {
    parent: string | undefined,
    id: string,
    name: string,
    children: string[],
    content: string[],
    meta: Metadata,
    tags: string[],
}

export type Asset = {
    parent: string,
    id: string,
    name: string,
    ty: AssetType,
    ext: string,
    meta: Metadata,
    tags: string[],
}

export type Tag = {
    id: string,
    name: string,
    color: string,
    meta: Metadata,
}

export type Metadata = {
    byteSize: number,
    createdAt: string,
    lastModified: string,
}

export type AssetType = "Image" | "Unknown"

export type DuplicateAssets = { [key: string]: string[] }

export type RecentLib = {
    path: string,
    name: string,
    lastOpen: string,
}

export type QuickRefTy = {
    asset: string[],
} | {
    folder: string,
} | {
    tag: string,
}

export function GetRecentLibs(): Promise<RecentLib[]> {
    return invoke("get_recent_libraries")
}

export function GetUserSettings(): Promise<UserSettings> {
    return invoke("get_user_settings")
}

export function GetDefaultSettings(): Promise<DefaultSettings> {
    return invoke("get_default_settings")
}

export function SetUserSetting(params: { tab: string, item: string, value: SettingsValue }): Promise<void> {
    return invoke("set_user_setting", params)
}

export function LoadLibrary(params: { rootFolder: string }): Promise<DuplicateAssets | undefined> {
    return invoke("load_library", params)
}

export function InitializeLibrary(params: { srcRootFolder: string, rootFolder: string }): Promise<DuplicateAssets | undefined> {
    return invoke("initialize_library", params)
}

export function SaveLibrary(): Promise<void> {
    return invoke("save_library")
}

export function ExportLibrary(params: { rootFolder: string }): Promise<void> {
    return invoke("export_library", params)
}

export function GetDuplicatedAssets(): Promise<DuplicateAssets> {
    return invoke("get_duplicated_assets")
}

export function ImportAssets(params: { path: string[], parent: string }): Promise<DuplicateAssets | undefined> {
    return invoke("import_assets", params)
}

export function ImportWebAssets(params: { urls: string[], parent: string, progress: Channel<DownloadEvent> }): Promise<DuplicateAssets | undefined> {
    return invoke("import_web_assets", params)
}

export function GetAssetAbsPath(params: { asset: string }): Promise<string> {
    return invoke("get_asset_abs_path", params)
}

export function GetAssetVirtualPath(params: { asset: string }): Promise<string[]> {
    return invoke("get_asset_virtual_path", params)
}

export function GetFolderVirtualPath(params: { folder: string }): Promise<string[]> {
    return invoke("get_folder_virtual_path", params)
}

export async function GetFolderTree(): Promise<Map<string, Folder>> {
    return invoke("get_folder_tree")
        .then(map => new Map(Object.entries(map as { [s: string]: Folder; })))
}

export function GetRootFolderId(): Promise<string> {
    return invoke("get_root_folder_id")
}

export function GetAllTags(): Promise<Tag[]> {
    return invoke("get_all_tags")
}

export function ModifyTag(params: { newTag: Tag }): Promise<void> {
    return invoke("modify_tag", params)
}

export function GetAssetsAt(params: { folder: string }): Promise<Asset[]> {
    return invoke("get_assets_at", params)
}

export function GetFolder(params: { folder: string }): Promise<Folder> {
    return invoke("get_folder", params)
}

export function GetAsset(params: { asset: string }): Promise<Asset> {
    return invoke("get_asset", params)
}

export function GetAssets(params: { assets: string[] }): Promise<Asset[]> {
    return invoke("get_assets", params)
}

export function GetTags(params: { tags: string[] }): Promise<Tag[]> {
    return invoke("get_tags", params)
}

export function DeltaTagsOf(params: { assets: string[], tags: string[], mode: "Add" | "Remove" }): Promise<void> {
    return invoke("delta_tags_of", params)
}

export function ModifyTagsOf(params: { assets: string[], newTags: string[] }): Promise<void> {
    return invoke("modify_tags_of", params)
}

export function GetAssetsContainingTag(params: { tag: string }): Promise<string[]> {
    return invoke("get_assets_containing_tag", params)
}

export function DeleteAssets(params: { assets: string[] }): Promise<void> {
    return invoke("delete_assets", params)
}

export function DeleteFolders(params: { folders: string[] }): Promise<void> {
    return invoke("delete_folders", params)
}

export function CreateFolders(params: { folderNames: string[], parent: string }): Promise<void> {
    return invoke("create_folders", params)
}

export function RenameAsset(params: { asset: string, name: string }): Promise<void> {
    return invoke("rename_asset", params)
}

export function RenameFolder(params: { folder: string, name: string }): Promise<void> {
    return invoke("rename_folder", params)
}

export function MoveAssetsTo(params: { assets: string[], folder: string }): Promise<void> {
    return invoke("move_assets_to", params)
}

export function MoveFoldersTo(params: { srcFolders: string[], dstFolder: string }): Promise<void> {
    return invoke("move_folders_to", params)
}

export function QuickRef(params: { ty: QuickRefTy }): Promise<void> {
    return invoke("quick_ref", params)
}
