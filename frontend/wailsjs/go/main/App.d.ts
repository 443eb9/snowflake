// Cynhyrchwyd y ffeil hon yn awtomatig. PEIDIWCH Â MODIWL
// This file is automatically generated. DO NOT EDIT
import {main} from '../models';
import {uuid} from '../models';

export function GetAbsPath(arg1:string):Promise<any>;

export function GetAllTags():Promise<Array<main.TagRef>>;

export function GetAssetRef(arg1:uuid.UUID):Promise<main.AssetRef>;

export function GetFolderRef(arg1:uuid.UUID):Promise<main.FolderRef>;

export function GetFolderTree():Promise<main.FolderTreeNode>;

export function GetRootFolder():Promise<main.FolderRef>;

export function InitializeLibrary():Promise<void>;

export function LoadLibrary():Promise<void>;

export function ModifyAsset(arg1:main.AssetRef):Promise<void>;

export function ModifyTag(arg1:main.TagRef):Promise<void>;

export function ModifyTagsOfAsset(arg1:main.AssetType,arg2:uuid.UUID,arg3:Array<main.TagRef>):Promise<void>;

export function SaveLibrary():Promise<void>;
