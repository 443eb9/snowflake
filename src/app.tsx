import AssetsGrid from "./assets-grid";
import Browser from "./browser";
import DetailInfo from "./detail-info";
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
    return (
        <ContextProvider>
            <HotKeys
                className="flex justify-between w-full h-full gap-2 p-4"
                keyMap={KeyMap}
                handlers={Handlers}
            >
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
                        <WindowControls />
                        <Text as="h2" weight="bold" align="end" size={400}>Asset Info</Text>
                    </div>
                    <DetailInfo />
                </div>
                <ContextMenu />
                <FileManipulator />
            </HotKeys>
        </ContextProvider>
    )
}
