import { createContext, ReactNode, useState } from "react"
import { Tag } from "./backend"


type StateContext<T> = {
    data: T | undefined,
    setter: (data: T | undefined) => void,
}

type VirtualFolder = {
    id: string | undefined,
    content: string[],
    path: string,
    collection: boolean,
}

export const allTagsContext = createContext<StateContext<Tag[]> | undefined>(undefined)
export const browsingFolderContext = createContext<StateContext<VirtualFolder> | undefined>(undefined)
export const selectedAssetContext = createContext<StateContext<string> | undefined>(undefined)

export default function ContextProvider({ children }: { children?: ReactNode }) {
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [browsingFolder, setBrowsingFolder] = useState<VirtualFolder | undefined>()
    const [selectedAsset, setSelectedAsset] = useState<string | undefined>()

    return (
        <allTagsContext.Provider value={{ data: allTags, setter: setAllTags }}>
            <browsingFolderContext.Provider value={{ data: browsingFolder, setter: setBrowsingFolder }}>
                <selectedAssetContext.Provider value={{ data: selectedAsset, setter: setSelectedAsset }}>
                    {children}
                </selectedAssetContext.Provider>
            </browsingFolderContext.Provider>
        </allTagsContext.Provider>
    )
}
