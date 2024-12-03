import { invoke } from "@tauri-apps/api/core";

export type Folder = {
    parent: string,
    name: string,
    path: string,
    children: string[],
    content: string[],
    meta: Metadata,
}

export type Tag = {
    name: string,
    color: string,
    meta: Metadata,
}

export type Metadata = {
    id: string,
    byte_size: number,
    created_at: Date,
    last_modified: Date,
}

export type Asset = {
    ty: AssetType,
    name: string,
    path: string,
    meta: Metadata,
}

export type AssetType = "Image" | "Unknown"

export function LoadLibrary(params: { rootFolder: string }): Promise<void> {
    return invoke("load_library", params)
}

export function SaveLibrary(): Promise<void> {
    return invoke("save_library")
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

export function GetTagsOf(params: { asset: string }): Promise<Tag[]> {
    return invoke("get_tags_of", params)
}

export function ModifyTagsOf(params: { asset: string, newTags: Tag[] }): Promise<void> {
    return invoke("modify_tags_of", params)
}

export function GetAssetsContainingTag(params: { tag: string }): Promise<string[]> {
    return invoke("get_assets_containing_tag", params)
}
