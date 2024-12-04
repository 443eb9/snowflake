import { createContext, ReactNode, useState } from "react"
import { Tag } from "./backend"


type StateContext<T> = {
    data: T | undefined,
    setter: (data: T | undefined) => void,
}

type VirtualFolder = {
    content: string[],
    path: string,
    collection: boolean,
}

export const allTagsContext = createContext<StateContext<Tag[]> | undefined>(undefined)
export const browsingFolderContext = createContext<StateContext<VirtualFolder> | undefined>(undefined)
export const selectedAssetsContext = createContext<StateContext<Set<string>> | undefined>(undefined)
export const selectedAssetsCountContext = createContext<StateContext<number> | undefined>(undefined)

export default function ContextProvider({ children }: { children?: ReactNode }) {
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [browsingFolder, setBrowsingFolder] = useState<VirtualFolder | undefined>()
    const [selectedAssets, setSelectedAssets] = useState<Set<string> | undefined>(new Set())
    const [selectedAssetsCount, setSelectedAssetsCount] = useState<number | undefined>(0)

    return (
        <allTagsContext.Provider value={{ data: allTags, setter: setAllTags }}>
            <browsingFolderContext.Provider value={{ data: browsingFolder, setter: setBrowsingFolder }}>
                <selectedAssetsContext.Provider value={{ data: selectedAssets, setter: setSelectedAssets }}>
                    <selectedAssetsCountContext.Provider value={{ data: selectedAssetsCount, setter: setSelectedAssetsCount }}>
                        {children}
                    </selectedAssetsCountContext.Provider>
                </selectedAssetsContext.Provider>
            </browsingFolderContext.Provider>
        </allTagsContext.Provider>
    )
}
