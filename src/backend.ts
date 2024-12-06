import { Channel, invoke } from "@tauri-apps/api/core";

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
    meta: Metadata,
    checksums: Checksums | undefined,
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

export type Checksums = {
    crc32: number,
    md5: string,
    sha1: string,
    sha256: string,
}

export type AssetType = "Image" | "Unknown"

export type RecentLib = {
    path: string,
    name: string,
    lastOpen: string,
}

export function GetRecentLibs(): Promise<RecentLib[]> {
    return invoke("get_recent_libraries")
}

export function LoadLibrary(params: { rootFolder: string }): Promise<void> {
    return invoke("load_library", params)
}

export function InitializeLibrary(params: { srcRootFolder: string, rootFolder: string }): Promise<void> {
    return invoke("initialize_library", params)
}

export function SaveLibrary(): Promise<void> {
    return invoke("save_library")
}

export function ImportAssets(params: { path: string[], parent: string }): Promise<void> {
    return invoke("import_assets", params)
}

export function ImportWebAssets(params: { urls: string[], parent: string, progress: Channel<DownloadEvent> }): Promise<void> {
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

export function ComputeChecksum(params: { asset: string }): Promise<Asset> {
    return invoke("compute_checksum", params)
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
    console.log(params)
    return invoke("move_assets_to", params)
}

export function MoveFoldersTo(params: { srcFolders: string[], dstFolder: string }): Promise<void> {
    return invoke("move_folders_to", params)
}
