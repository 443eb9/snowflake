import AssetsGrid from "./widgets/assets-grid";
import Browser from "./widgets/browser";
import DetailInfo from "./widgets/detail-info";
import WindowControls from "./widgets/window-controls";
import TagsManager from "./widgets/tags-manager";
import { HotKeys } from "react-hotkeys";
import { SaveLibrary } from "./backend";
import { Text } from "@fluentui/react-components";
import ContextProvider from "./context-provider";
import { BrowsingPath } from "./widgets/browsing-path";
import AssetManipulation from "./widgets/asset-manipulation";
import ContextMenu from "./widgets/context-menu";
import FileManipulator from "./file-manipulator";
import OverlayPanel from "./widgets/overlay-panel";
import { useEffect, useState } from "react";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import { DragDropHandler } from "./drag-drop-handler";

const KeyMap = {
    save: "ctrl+s"
}

const Handlers = {
    save: async () => {
        await SaveLibrary()
            .catch(err => {
                // TODO error handling
                console.error(err)
            })
    }
}

export default function MainApp() {
    const [windowSize, setWindowSize] = useState<PhysicalSize | undefined>()

    useEffect(() => {
        async function setWindowSizeAsync() {
            const size = await getCurrentWindow().innerSize()
            setWindowSize(size)
        }
        setWindowSizeAsync()
    }, [windowSize])

    if (!windowSize) {
        return <></>
    }

    return (
        <ContextProvider>
            <HotKeys
                className="w-full h-full"
                keyMap={KeyMap}
                handlers={Handlers}
            >
                <DragDropHandler />
                <OverlayPanel />
                <div className="absolute top-2 right-2 z-20" style={{ width: `${windowSize.width * 0.15}px` }}>
                    <WindowControls />
                </div>
                <div className="flex justify-between w-full h-full gap-2 p-4">
                    <div className="max-w-96 min-w-48 flex flex-col gap-2 justify-between">
                        <Text as="h2" weight="bold" size={600}>Library</Text>
                        <div className="h-full overflow-y-auto">
                            <Browser />
                        </div>
                        <TagsManager />
                    </div>
                    <div className="w-full flex h-full flex-col gap-1">
                        <BrowsingPath />
                        <AssetManipulation />
                        <AssetsGrid />
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-2">
                            <div className="h-4"></div>
                            <Text as="h2" weight="bold" align="end" size={400}>Asset Info</Text>
                        </div>
                        <div
                            className="flex flex-col gap-2 h-full overflow-y-auto p-1"
                            style={{ width: `${windowSize.width * 0.15}px` }}
                        >
                            <DetailInfo />
                        </div>
                    </div>
                    <ContextMenu />
                    <FileManipulator />
                </div>
            </HotKeys>
        </ContextProvider>
    )
}
