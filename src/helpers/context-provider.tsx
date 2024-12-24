import { createContext, ReactNode, useState } from "react"
import { ItemId } from "../backend"

export type StateContext<T> = {
    data: T | undefined,
    setter: (data: T | undefined) => void,
}

export type VirtualFolderSubTy = "recycleBinAssets" | "recycleBinCollections" | "recycleBinTags" | "tag" | "uncategorized" | "all"

export type VirtualFolder = {
    id: string | undefined,
    name: string,
    content: ItemId[],
    subTy: VirtualFolderSubTy,
}

export type FileManipulation = {
    id: ItemId[],
    op: "rename" | "deletion" | "deletionPermanent" | "create" | "import" | "move" | "recover" | "recolor" | "regroup" | undefined,
    submit: string[] | undefined,
}

export type ContextMenuProp = {
    ty: "asset",
    data: string[],
} | {
    ty: "collection",
    data: string[],
} | {
    ty: "tag",
    data: string[],
}

export type Overlays = {
    ty: "assetDownload" | "settings" | "globalSearch" | undefined,
    noTemplate?: boolean,
}

export const browsingFolderContext = createContext<StateContext<VirtualFolder> | undefined>(undefined)
export const selectedItemsContext = createContext<StateContext<ItemId[]> | undefined>(undefined)
export const fileManipulationContext = createContext<StateContext<FileManipulation> | undefined>(undefined)
export const contextMenuPropContext = createContext<StateContext<ContextMenuProp> | undefined>(undefined)
export const overlaysContext = createContext<StateContext<Overlays> | undefined>(undefined)
export const settingsChangeFlagContext = createContext<StateContext<boolean> | undefined>(undefined)

export default function ContextProvider({ children }: { children?: ReactNode }) {
    const [browsingFolder, setBrowsingFolder] = useState<VirtualFolder | undefined>()
    const [selectedItems, setSelectedItems] = useState<ItemId[] | undefined>([])
    const [fileManipulation, setFileManipulation] = useState<FileManipulation | undefined>()
    const [contextMenuProp, setContextMenuProp] = useState<ContextMenuProp | undefined>()
    const [overlays, setOverlays] = useState<Overlays | undefined>(undefined)
    const [settingsChange, setSettingsChangeFlag] = useState<boolean | undefined>(false)

    return (
        <browsingFolderContext.Provider value={{ data: browsingFolder, setter: setBrowsingFolder }}>
            <selectedItemsContext.Provider value={{ data: selectedItems, setter: setSelectedItems }}>
                <fileManipulationContext.Provider value={{ data: fileManipulation, setter: setFileManipulation }}>
                    <contextMenuPropContext.Provider value={{ data: contextMenuProp, setter: setContextMenuProp }}>
                        <overlaysContext.Provider value={{ data: overlays, setter: setOverlays }}>
                            <settingsChangeFlagContext.Provider value={{ data: settingsChange, setter: setSettingsChangeFlag }}>
                                {children}
                            </settingsChangeFlagContext.Provider>
                        </overlaysContext.Provider>
                    </contextMenuPropContext.Provider>
                </fileManipulationContext.Provider>
            </selectedItemsContext.Provider>
        </browsingFolderContext.Provider>
    )
}
