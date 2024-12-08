import { createContext, ReactNode, useState } from "react"
import { Tag } from "./backend"

export type StateContext<T> = {
    data: T | undefined,
    setter: (data: T | undefined) => void,
}

export type VirtualFolder = {
    id: string | undefined,
    name: string,
    content: string[],
    collection: boolean,
}

export type FileManipulation = {
    id: string[],
    id_ty: "folder" | "assets" | "collection",
    ty: "rename" | "deletion" | "create" | "import" | "move" | undefined,
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
export const selectedAssetsContext = createContext<StateContext<string[]> | undefined>(undefined)
export const fileManipulationContext = createContext<StateContext<FileManipulation> | undefined>(undefined)
export const contextMenuPropContext = createContext<StateContext<ContextMenuProp> | undefined>(undefined)
export const overlaysContext = createContext<StateContext<Overlays> | undefined>(undefined)

export default function ContextProvider({ children }: { children?: ReactNode }) {
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [browsingFolder, setBrowsingFolder] = useState<VirtualFolder | undefined>()
    const [selectedAssets, setSelectedAssets] = useState<string[] | undefined>([])
    const [fileManipulation, setFileManipulation] = useState<FileManipulation | undefined>()
    const [contextMenuProp, setContextMenuProp] = useState<ContextMenuProp | undefined>()
    const [overlays, setOverlays] = useState<Overlays | undefined>(undefined)

    return (
        <allTagsContext.Provider value={{ data: allTags, setter: setAllTags }}>
            <browsingFolderContext.Provider value={{ data: browsingFolder, setter: setBrowsingFolder }}>
                <selectedAssetsContext.Provider value={{ data: selectedAssets, setter: setSelectedAssets }}>
                    <fileManipulationContext.Provider value={{ data: fileManipulation, setter: setFileManipulation }}>
                        <contextMenuPropContext.Provider value={{ data: contextMenuProp, setter: setContextMenuProp }}>
                            <overlaysContext.Provider value={{ data: overlays, setter: setOverlays }}>
                                {children}
                            </overlaysContext.Provider>
                        </contextMenuPropContext.Provider>
                    </fileManipulationContext.Provider>
                </selectedAssetsContext.Provider>
            </browsingFolderContext.Provider>
        </allTagsContext.Provider>
    )
}
