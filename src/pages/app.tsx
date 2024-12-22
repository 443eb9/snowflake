import ItemsGrid from "../widgets/items-grid";
import Browser from "../widgets/browser";
import DetailInfo from "../widgets/detail-info";
import WindowControls from "../widgets/window-controls";
import { Button, Subtitle1, Title3, useToastController } from "@fluentui/react-components";
import { BrowsingPath } from "../widgets/browsing-path";
import AssetManipulation from "../widgets/asset-manipulation";
import FileManipulator from "../helpers/file-manipulator";
import OverlayPanel from "./overlay-panel";
import { useContext, useEffect, useState } from "react";
import { ArrowExit20Regular, Settings20Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import "../context.css"
import { t } from "../i18n";
import { overlaysContext } from "../helpers/context-provider";
import ShortcutKeyProvider from "../helpers/shortcut-key-provider";
import RecycleBin from "../widgets/recycle-bin";
import RecycleBinContextMenu from "../widgets/context-menus/recycle-bin-context-menu";
import CollectionTagContextMenu from "../widgets/context-menus/collection-tag-context-menu";
import LayoutResizeBar from "../components/layout-resize-bar";
import { GetDefaultSetting, GetUserSetting, SetUserSetting } from "../backend";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/toasts/err-toast";
import { listen } from "@tauri-apps/api/event";

const maxRatio = 0.45

export default function MainApp() {
    const nav = useNavigate()
    const overlay = useContext(overlaysContext)
    const { dispatchToast } = useToastController(GlobalToasterId)

    const [windowWidth, setWindowWidth] = useState(window.innerWidth)
    const [defaultPanelWidth, setDefaultPanelWidth] = useState<{ left: number, right: number } | undefined>()
    const [leftPanelWidth, setLeftPanelWidth] = useState<number | undefined>()
    const [rightPanelWidth, setRightPanelWidth] = useState<number | undefined>()

    useEffect(() => {
        const unlisten = listen("tauri://resize", () => {
            setWindowWidth(document.querySelector("body")!.clientWidth)
        })

        return () => {
            unlisten.then(f => f())
        }
    }, [])

    useEffect(() => {
        async function handle() {
            if (!defaultPanelWidth) { return }

            const max = windowWidth * maxRatio
            if (leftPanelWidth && leftPanelWidth > max && leftPanelWidth > defaultPanelWidth.left) {
                setLeftPanelWidth(max)
                await SetUserSetting({ category: "general", item: "leftPanelWidth", value: max })
                    .catch(err => dispatchToast(<ErrToast body={err} />))
            }
            if (rightPanelWidth && rightPanelWidth > max && rightPanelWidth > defaultPanelWidth.right) {
                setRightPanelWidth(max)
                await SetUserSetting({ category: "general", item: "rightPanelWidth", value: max })
                    .catch(err => dispatchToast(<ErrToast body={err} />))
            }
        }

        handle()
    }, [windowWidth])

    useEffect(() => {
        async function fetch() {
            const leftPanelWidth = await GetUserSetting({ category: "general", item: "leftPanelWidth" })
                .catch(err => dispatchToast(<ErrToast body={err} />))
            if (leftPanelWidth) {
                setLeftPanelWidth(leftPanelWidth as number)
            }

            const rightPanelWidth = await GetUserSetting({ category: "general", item: "rightPanelWidth" })
                .catch(err => dispatchToast(<ErrToast body={err} />))
            if (rightPanelWidth) {
                setRightPanelWidth(rightPanelWidth as number)
            }

            const defaultLeftPanelWidth = await GetDefaultSetting({ category: "general", item: "leftPanelWidth" })
                .catch(err => dispatchToast(<ErrToast body={err} />))
            const defaultRightPanelWidth = await GetDefaultSetting({ category: "general", item: "rightPanelWidth" })
                .catch(err => dispatchToast(<ErrToast body={err} />))
            if (defaultLeftPanelWidth && defaultRightPanelWidth) {
                setDefaultPanelWidth({
                    left: defaultLeftPanelWidth as number,
                    right: defaultRightPanelWidth as number,
                })
            }
        }

        fetch()
    }, [])

    if (!leftPanelWidth || !rightPanelWidth || !defaultPanelWidth) {
        return <></>
    }

    return (
        <ShortcutKeyProvider className="w-full h-full">
            <OverlayPanel />
            <div className="absolute top-2 right-2 z-20" style={{ width: `${rightPanelWidth}px` }}>
                <WindowControls />
            </div>
            <div className="flex justify-between w-full h-full p-4">
                <div
                    className="flex flex-col overflow-hidden gap-2 justify-between"
                    style={{
                        width: `${leftPanelWidth}px`,
                        minWidth: `${leftPanelWidth}px`,
                    }}
                >
                    <div className="flex items-center gap-2">
                        <Button icon={<ArrowExit20Regular />} onClick={() => nav("/")} appearance="outline" />
                        <Title3>{t("app.libTitle")}</Title3>
                    </div>
                    <div className="h-full overflow-y-auto">
                        <Browser />
                    </div>
                    <div className="flex gap-2">
                        <Button icon={<Settings20Regular />} onClick={() => overlay?.setter({ ty: "settings" })} appearance="outline" />
                        <RecycleBin />
                    </div>
                </div>
                <LayoutResizeBar
                    resizeDir="horizontal"
                    defaultValue={leftPanelWidth}
                    size="5px"
                    onResize={async val => {
                        if (val > window.innerWidth * maxRatio || val < defaultPanelWidth.left) { return }
                        setLeftPanelWidth(val)
                    }}
                    onEndResize={async () => {
                        await SetUserSetting({ category: "general", item: "leftPanelWidth", value: leftPanelWidth })
                            .catch(err => dispatchToast(<ErrToast body={err} />))
                    }}
                />
                <div className="flex flex-col flex-grow gap-1 overflow-hidden" style={{}}>
                    <BrowsingPath />
                    <AssetManipulation />
                    <ItemsGrid />
                </div>
                <LayoutResizeBar
                    resizeDir="horizontal"
                    factor={-1}
                    defaultValue={rightPanelWidth}
                    size="5px"
                    onResize={async val => {
                        if (val > window.innerWidth * maxRatio || val < defaultPanelWidth.right) { return }
                        setRightPanelWidth(val)
                    }}
                    onEndResize={async () => {
                        await SetUserSetting({ category: "general", item: "rightPanelWidth", value: rightPanelWidth })
                            .catch(err => dispatchToast(<ErrToast body={err} />))
                    }}
                />
                <div
                    className="flex flex-col gap-2 overflow-hidden"
                    style={{
                        width: `${rightPanelWidth}px`,
                        minWidth: `${rightPanelWidth}px`,
                    }}
                >
                    <div className="flex flex-col gap-2">
                        <div className="h-6" />
                        <Subtitle1 align="end">{t("app.assetInfoTitle")}</Subtitle1>
                    </div>
                    <div className="flex flex-col gap-2 h-full overflow-y-auto p-1">
                        <DetailInfo />
                    </div>
                </div>
                <RecycleBinContextMenu />
                <CollectionTagContextMenu />
                <FileManipulator />
            </div>
        </ShortcutKeyProvider>
    )
}
