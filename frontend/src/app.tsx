import { useState } from "react";
import AssetsGrid from "./assets-grid";
import Browser from "./browser";
import DetailInfo from "./detail-info";
import WindowControls from "./widgets/window-controls";
import TagsManager from "./widgets/tags-manager";

export default function MainApp() {
    const [browsingFolder, setBrowsingFolder] = useState<string | undefined>()
    const [selectedAsset, setSelectedAsset] = useState<string | undefined>()

    return (
        <div className="flex justify-between w-full h-full gap-2 p-4">
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
        </div>
    )
}
