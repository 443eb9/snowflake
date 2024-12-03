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
import FileManipulation from "./widgets/file-manipulation";

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
                    <Text as="h2">Library</Text>
                    <div className="h-full overflow-y-auto">
                        <Browser />
                    </div>
                    <TagsManager />
                </div>
                <div className="w-full flex flex-col gap-1">
                    <BrowsingPath />
                    <FileManipulation />
                    <AssetsGrid />
                </div>
                <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                        <WindowControls />
                    </div>
                    <DetailInfo></DetailInfo>
                </div>
            </HotKeys>
        </ContextProvider>
    )
}
