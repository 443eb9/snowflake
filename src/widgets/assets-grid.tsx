import { useContext, useEffect, useRef, useState } from "react"
import AssetPreview from "../widgets/asset-preview"
import { Asset, GetAssets } from "../backend"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedAssetsContext } from "../context-provider"
import Selecto from "react-selecto";
import { darkenContentStyleHook } from "../styling";
import { mergeClasses, useToastController } from "@fluentui/react-components";
import { TriggerEvent, useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menu";
import ErrToast from "./err-toast";
import { GlobalToasterId } from "../main";

export default function AssetsGrid() {
    const [assets, setAssets] = useState<Asset[] | undefined>()
    const selectoRef = useRef<Selecto & HTMLElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const darkenContentStyle = darkenContentStyleHook()

    const { show: showCtxMenu } = useContextMenu({ id: CtxMenuId })
    const { dispatchToast } = useToastController(GlobalToasterId)

    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const handleContextMenu = (ev: TriggerEvent) => {
        const currentSelected = selectedAssets?.data?.length ?? 0
        if (selectoRef.current && ev.target && currentSelected < 2) {
            let target = ev.target as HTMLElement
            while (target.id.length == 0) {
                target = target.parentNode as HTMLElement
            }

            selectoRef.current.setSelectedTargets([target])
            selectedAssets?.setter([target.id])
            target.classList.add("selected-asset")
        }

        contextMenuProp?.setter({
            target: "assets",
            extra: undefined,
        })
        showCtxMenu({ event: ev })
    }

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data) {
                setAssets(undefined)
                return
            }

            const assets = await GetAssets({ assets: browsingFolder.data.content })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (assets) {
                setAssets(assets)
            }

            if (selectoRef.current) {
                selectoRef.current.setSelectedTargets([])
            }
        }

        fetch()
    }, [browsingFolder?.data])

    return (
        <div className={mergeClasses("flex w-full flex-col gap-2 rounded-md h-full overflow-y-auto", darkenContentStyle.root)}>
            <Selecto
                ref={selectoRef}
                container={gridRef.current}
                selectableTargets={[".selectable-asset"]}
                hitRate={0}
                selectByClick
                toggleContinueSelect={"shift"}
                dragCondition={() => fileManipulation?.data?.ty != "rename"}
                onSelect={ev => {
                    ev.added.forEach(elem => elem.classList.add("selected-asset"))
                    ev.removed.forEach(elem => elem.classList.remove("selected-asset"))

                    const removed = new Set(ev.removed.map(elem => elem.id))
                    const selected = ev.added.map(elem => elem.id)
                        .concat(selectedAssets?.data ?? [])
                        .filter(id => !removed.has(id))
                        .filter(id => id != null)
                    selectedAssets?.setter(selected)
                }}
            />
            {
                assets &&
                <div className="flex w-full flex-wrap gap-2 overflow-x-hidden" ref={gridRef}>
                    {
                        assets.map((asset, index) => {
                            if (asset.ty != "Image") {
                                return undefined
                            }

                            return (
                                <AssetPreview
                                    key={index}
                                    asset={asset}
                                    onContextMenu={handleContextMenu}
                                />
                            )
                        })
                    }
                </div>
            }
        </div>
    )
}
