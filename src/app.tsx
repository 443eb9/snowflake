import AssetsGrid from "./widgets/assets-grid";
import Browser from "./widgets/browser";
import DetailInfo from "./widgets/detail-info";
import WindowControls from "./widgets/window-controls";
import TagsManager from "./widgets/tags-manager";
import { HotKeys } from "react-hotkeys";
import { SaveLibrary } from "./backend";
import { Button, Subtitle1, Text, Title3 } from "@fluentui/react-components";
import { BrowsingPath } from "./widgets/browsing-path";
import AssetManipulation from "./widgets/asset-manipulation";
import ContextMenu from "./widgets/context-menu";
import FileManipulator from "./file-manipulator";
import OverlayPanel from "./widgets/overlay-panel";
import { useContext, useEffect, useState } from "react";
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window";
import { ArrowExit20Regular, Settings20Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import "./context.css"
import { t } from "./i18n";
import { overlaysContext } from "./context-provider";

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
    const nav = useNavigate()

    const overlay = useContext(overlaysContext)

    useEffect(() => {
        async function setWindowSizeAsync() {
            const size = await getCurrentWindow().innerSize()
            // console.log(await getCurrentWindow().innerSize())
            setWindowSize(size)
        }
        setWindowSizeAsync()
    })

    if (!windowSize) {
        return <></>
    }

    return (
        <HotKeys
            className="w-full h-full"
            keyMap={KeyMap}
            handlers={Handlers}
        >
            <OverlayPanel />
            <div className="absolute top-2 right-2 z-20 w-[20vw]">
                <WindowControls />
            </div>
            <div className="flex justify-between w-full h-full gap-2 p-4">
                <div className="max-w-96 min-w-48 flex flex-col gap-2 justify-between">
                    <div className="flex items-center gap-2">
                        <Button icon={<ArrowExit20Regular />} onClick={() => nav("/")}></Button>
                        <Title3>{t("app.libTitle")}</Title3>
                    </div>
                    <div className="h-full overflow-y-auto">
                        <Browser />
                    </div>
                    <div className="flex gap-2">
                        <TagsManager />
                        <Button icon={<Settings20Regular />} onClick={() => overlay?.setter({ ty: "settings" })} />
                    </div>
                </div>
                <div className="w-full flex h-full flex-col gap-1">
                    <BrowsingPath />
                    <AssetManipulation />
                    <AssetsGrid />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2">
                        <div className="h-6"></div>
                        <Subtitle1 align="end">{t("app.assetInfoTitle")}</Subtitle1>
                    </div>
                    <div className="flex flex-col gap-2 w-[20vw] h-full overflow-y-auto p-1">
                        <DetailInfo />
                    </div>
                </div>
                <ContextMenu />
                <FileManipulator />
            </div>
        </HotKeys>
    )
}
