import { useContext, useState } from "react"
import { overlaysContext } from "../helpers/context-provider"
import AssetDownload from "./asset-download"
import { Button } from "@fluentui/react-components"
import { Dismiss20Regular } from "@fluentui/react-icons"
import Settings from "./settings"
import GlobalSearcher from "./global-searcher"

export default function OverlayPanel() {
    const overlays = useContext(overlaysContext)
    const [locked, setLocked] = useState(false)

    function getOverlay() {
        if (!overlays?.data) { return <></> }

        switch (overlays.data.ty) {
            case "assetDownload":
                return <AssetDownload lockOverlay={setLocked} />
            case "settings":
                return <Settings />
            case "globalSearch":
                return <GlobalSearcher />
        }
    }

    if (!overlays?.data) { return <></> }

    return (
        <div
            className="absolute w-full h-full z-10 flex items-center justify-center shadow-md"
            style={{
                backgroundColor: "#000000aa",
            }}
        >
            {
                overlays.data.noTemplate
                    ? getOverlay()
                    : <div
                        className="absolute w-4/5 h-4/5 rounded-md p-4"
                        style={{
                            backgroundColor: "var(--colorNeutralBackground2)"
                        }}
                    >
                        <Button
                            className="absolute right-2 top-2"
                            icon={<Dismiss20Regular />}
                            onClick={() => overlays?.setter(undefined)}
                            disabled={locked}
                        />
                        {getOverlay()}
                    </div>
            }
        </div>
    )
}
