import { useState } from "react";
import AssetsGrid from "./assets-grid";
import Browser from "./browser";
import DetailInfo from "./detail-info";
import WindowControls from "./widgets/window-controls";
import TagsManager from "./widgets/tags-manager";
import { HotKeys } from "react-hotkeys";
import { SaveLibrary } from "../wailsjs/go/main/App";

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

export default function MainApp() {
    const [browsingFolder, setBrowsingFolder] = useState<string | undefined>()
    const [selectedAsset, setSelectedAsset] = useState<string | undefined>()

    return (
        <HotKeys
            className="flex justify-between w-full h-full gap-2 p-4"
            keyMap={KeyMap}
            handlers={Handlers}
        >
            <div className="max-w-96 min-w-48 flex flex-col justify-between">
                <Browser setBrowsingFolderCallback={(id) => {
                    setBrowsingFolder(id)
                    setSelectedAsset(undefined)
                }} />
                <TagsManager />
            </div>
            <div className="">
                <AssetsGrid id={browsingFolder} setSelectedAsset={setSelectedAsset}></AssetsGrid>
            </div>
            <div className="flex flex-col gap-4">
                <div className="flex justify-end">
                    <WindowControls />
                </div>
                <DetailInfo id={selectedAsset}></DetailInfo>
            </div>
        </HotKeys>
    )
}
