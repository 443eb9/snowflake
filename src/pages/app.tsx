import ItemsGrid from "../widgets/items-grid";
import Browser from "../widgets/browser";
import DetailInfo from "../widgets/detail-info";
import WindowControls from "../widgets/window-controls";
import { Button, Subtitle1, Title3 } from "@fluentui/react-components";
import { BrowsingPath } from "../widgets/browsing-path";
import AssetManipulation from "../widgets/asset-manipulation";
import FileManipulator from "../helpers/file-manipulator";
import OverlayPanel from "./overlay-panel";
import { useContext } from "react";
import { ArrowExit20Regular, Settings20Regular } from "@fluentui/react-icons";
import { useNavigate } from "react-router-dom";
import "../context.css"
import { t } from "../i18n";
import { overlaysContext } from "../helpers/context-provider";
import ShortcutKeyProvider from "../helpers/shortcut-key-provider";
import RecycleBin from "../widgets/recycle-bin";
import RecycleBinContextMenu from "../widgets/context-menus/recycle-bin-context-menu";
import CollectionTagContextMenu from "../widgets/context-menus/collection-tag-context-menu";

export default function MainApp() {
    const nav = useNavigate()
    const overlay = useContext(overlaysContext)

    return (
        <ShortcutKeyProvider className="w-full h-full">
            <OverlayPanel />
            <div className="absolute top-2 right-2 z-20 w-[20vw]">
                <WindowControls />
            </div>
            <div className="flex justify-between w-full h-full gap-2 p-4">
                <div className="min-w-48 flex flex-col gap-2 justify-between">
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
                <div className="w-full flex h-full flex-col gap-1">
                    <BrowsingPath />
                    <AssetManipulation />
                    <ItemsGrid />
                </div>
                <div className="flex flex-col gap-2">
                    <div className="flex flex-col gap-2">
                        <div className="h-6" />
                        <Subtitle1 align="end">{t("app.assetInfoTitle")}</Subtitle1>
                    </div>
                    <div className="flex flex-col gap-2 w-[20vw] h-full overflow-y-auto p-1">
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
