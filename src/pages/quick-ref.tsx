import { convertFileSrc } from "@tauri-apps/api/core"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { MouseEvent, useEffect, useState, WheelEvent } from "react"
import { useParams } from "react-router-dom"
import { Asset, GetAssetAbsPath, GetItem } from "../backend"
import { useContextMenu } from "react-contexify"
import QuickRefContextMenu, { QuickRefCtxMenuId } from "../widgets/context-menus/quick-ref-context-menu"
import GraphicsReference from "../widgets/quick-ref/graphics-reference"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/toasts/err-toast"
import ModelReference from "../widgets/quick-ref/model-reference"

const appWindow = getCurrentWindow()

export default function QuickRef() {
    const { id } = useParams()
    const [absPath, setAbsPath] = useState<string | undefined>()
    const { show: showContextMenu } = useContextMenu({ id: QuickRefCtxMenuId })
    const [scaleFactor, setScaleFactor] = useState(1)
    const [asset, setAsset] = useState<Asset>()
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            if (id) {
                const path = await GetAssetAbsPath({ asset: id })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                if (path) {
                    setAbsPath(path)
                }

                const asset = await GetItem({ item: { id, ty: "asset" } })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                if (asset) {
                    setAsset(asset.data as Asset)
                }
            }
        }

        fetch()
    }, [id])

    useEffect(() => {
        const handleExit = (ev: KeyboardEvent) => {
            if (ev.key == "Escape") {
                appWindow.close()
            }
        }
        document.addEventListener("keydown", handleExit)

        return () => {
            document.removeEventListener("keydown", handleExit)
        }
    }, [])

    if (!absPath || !asset) {
        return <></>
    }

    const props = {
        className: "w-full h-full",
        "data-tauri-drag-region": true,
        onClick: (ev: MouseEvent) => {
            if (ev.buttons == 1) {
                appWindow.startDragging()
            }
        },
        onWheel: async (ev: WheelEvent) => {
            const size = await appWindow.innerSize()
            const newScale = scaleFactor * (1 - ev.deltaY * 0.01 * 0.05)
            setScaleFactor(newScale)

            // TODO not working, wait for next tauri release
            const scaled = {
                width: Math.round(size.width * newScale),
                height: Math.round(size.height * newScale),
            }
            await appWindow.setSize(new PhysicalSize(scaled))
                .catch(err => dispatchToast(<ErrToast body={err} />))
        },
        onContextMenu: (ev: MouseEvent) => showContextMenu({ event: ev }),
    }

    function getReference() {
        if (!asset || !absPath) { return }

        switch (asset.ty) {
            case "rasterGraphics":
            case "vectorGraphics":
                return (
                    <GraphicsReference
                        {...props}
                        src={convertFileSrc(absPath)}
                    />
                )
            case "gltfModel":
                return (
                    <ModelReference
                        {...props}
                        src={absPath}
                        asset={asset.id}
                    />
                )
        }
    }

    return (
        <>
            <QuickRefContextMenu asset={asset} />
            {getReference()}
        </>
    )
}
