import { createContext, ReactNode, useState } from "react"
import { ItemId, Tag } from "../backend"

export type StateContext<T> = {
    data: T | undefined,
    setter: (data: T | undefined) => void,
}

export type VirtualFolder = {
    id: string | undefined,
    name: string,
    content: ItemId[],
    specialTy: "collection" | "recycleBin" | "folder",
}

export type FileManipulation = {
    id: ItemId[],
    op: "rename" | "deletion" | "deletionPermanent" | "create" | "import" | "move" | undefined,
    submit: string[] | undefined,
}

export type ContextMenuProp = {
    target: "folder" | "assets" | "collection",
    extra: string | undefined,
}

export type Overlays = {
    ty: "assetDownload" | "settings" | undefined,
}

export const allTagsContext = createContext<StateContext<Tag[]> | undefined>(undefined)
export const browsingFolderContext = createContext<StateContext<VirtualFolder> | undefined>(undefined)
export const selectedObjectsContext = createContext<StateContext<ItemId[]> | undefined>(undefined)
export const fileManipulationContext = createContext<StateContext<FileManipulation> | undefined>(undefined)
export const contextMenuPropContext = createContext<StateContext<ContextMenuProp> | undefined>(undefined)
export const overlaysContext = createContext<StateContext<Overlays> | undefined>(undefined)
export const settingsChangeFlagContext = createContext<StateContext<boolean> | undefined>(undefined)

export default function ContextProvider({ children }: { children?: ReactNode }) {
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [browsingFolder, setBrowsingFolder] = useState<VirtualFolder | undefined>()
    const [selectedObjects, setselectedObjects] = useState<ItemId[] | undefined>([])
    const [fileManipulation, setFileManipulation] = useState<FileManipulation | undefined>()
    const [contextMenuProp, setContextMenuProp] = useState<ContextMenuProp | undefined>()
    const [overlays, setOverlays] = useState<Overlays | undefined>(undefined)
    const [settingsChange, setSettingsChangeFlag] = useState<boolean | undefined>(false)

    return (
        <allTagsContext.Provider value={{ data: allTags, setter: setAllTags }}>
            <browsingFolderContext.Provider value={{ data: browsingFolder, setter: setBrowsingFolder }}>
                <selectedObjectsContext.Provider value={{ data: selectedObjects, setter: setselectedObjects }}>
                    <fileManipulationContext.Provider value={{ data: fileManipulation, setter: setFileManipulation }}>
                        <contextMenuPropContext.Provider value={{ data: contextMenuProp, setter: setContextMenuProp }}>
                            <overlaysContext.Provider value={{ data: overlays, setter: setOverlays }}>
                                <settingsChangeFlagContext.Provider value={{ data: settingsChange, setter: setSettingsChangeFlag }}>
                                    {children}
                                </settingsChangeFlagContext.Provider>
                            </overlaysContext.Provider>
                        </contextMenuPropContext.Provider>
                    </fileManipulationContext.Provider>
                </selectedObjectsContext.Provider>
            </browsingFolderContext.Provider>
        </allTagsContext.Provider>
    )
}
