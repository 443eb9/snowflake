import { createContext, useState } from "react";
import AssetsGrid from "./assets-grid";
import Browser from "./browser";
import DetailInfo from "./detail-info";
import WindowControls from "./widgets/window-controls";
import TagsManager from "./widgets/tags-manager";
import { HotKeys } from "react-hotkeys";
import { SaveLibrary, Tag } from "./backend";
import { Text } from "@fluentui/react-components";

const KeyMap = {
    SAVE: "ctrl+s"
}

const Handlers = {
    SAVE: async () => {
        await SaveLibrary()
            .catch(err => {
                // TODO error handling
                console.error(err)
            })
    }
}

type StateContext<T> = {
    data: T | undefined,
    setter: (data: T) => void,
}

type VirtualFolder = {
    content: string[],
    path: string,
}

export const allTagsContext = createContext<StateContext<Tag[]> | undefined>(undefined)
export const browsingFolderContext = createContext<StateContext<VirtualFolder> | undefined>(undefined)
export const selectedAssetContext = createContext<StateContext<string> | undefined>(undefined)

export default function MainApp() {
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [browsingFolder, setBrowsingFolder] = useState<VirtualFolder | undefined>()
    const [selectedAsset, setSelectedAsset] = useState<string | undefined>()

    return (
        <allTagsContext.Provider value={{ data: allTags, setter: setAllTags }}>
            <browsingFolderContext.Provider value={{ data: browsingFolder, setter: setBrowsingFolder }}>
                <selectedAssetContext.Provider value={{ data: selectedAsset, setter: setSelectedAsset }}>
                    <HotKeys
                        className="flex justify-between w-full h-full gap-2 p-4"
                        keyMap={KeyMap}
                        handlers={Handlers}
                    >
                        <div className="max-w-96 min-w-48 flex flex-col gap-2 justify-between">
                            <Text as="h2">Library</Text>
                            <div className="h-full overflow-y-auto">
                                <Browser />
                            </div>
                            <TagsManager />
                        </div>
                        <div className="w-full">
                            <AssetsGrid />
                        </div>
                        <div className="flex flex-col gap-4">
                            <div className="flex flex-col gap-2">
                                <WindowControls />
                                {selectedAsset && <Text as="h2" align="end" size={500}>File Detail</Text>}
                            </div>
                            <DetailInfo id={selectedAsset}></DetailInfo>
                        </div>
                    </HotKeys>
                </selectedAssetContext.Provider>
            </browsingFolderContext.Provider>
        </allTagsContext.Provider>
    )
}
