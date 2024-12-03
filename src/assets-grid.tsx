import { useContext, useEffect, useRef, useState } from "react"
import AssetPreview from "./widgets/asset-preview"
import { Asset, GetAssets } from "./backend"
import { browsingFolderContext } from "./context-provider"
import Selecto from "react-selecto";
import { darkenContentStyleHook } from "./styling";
import { mergeClasses } from "@fluentui/react-components";

export default function AssetsGrid() {
    const [assets, setAssets] = useState<Asset[] | undefined>()
    const gridRef = useRef<HTMLDivElement>(null)
    const darkenContentStyle = darkenContentStyleHook()

    const browsingFolder = useContext(browsingFolderContext)

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data) {
                setAssets(undefined)
                return
            }

            const assets = await GetAssets({ assets: browsingFolder.data.content })
                .catch(err => {
                    // TODO error handling
                    console.log(err)
                })

            if (assets) {
                setAssets(assets)
            }
        }

        fetch()
    }, [browsingFolder])

    return (
        <div className={mergeClasses("flex w-full flex-col gap-2 rounded-md max-h-full overflow-y-auto", darkenContentStyle.root)}>
            <Selecto
                container={gridRef.current}
                selectableTargets={[".selectable-asset"]}
                hitRate={0}
                selectByClick
                onSelect={ev => {
                    ev.added.forEach(elem => {
                        elem.dispatchEvent(new Event("selected"))
                    })
                    ev.removed.forEach(elem => {
                        elem.dispatchEvent(new Event("deselected"))
                    })
                }}
            />
            {
                assets &&
                <div className="flex w-full flex-wrap gap-2" ref={gridRef}>
                    {
                        assets.map((asset, index) => {
                            if (asset.ty != "Image") {
                                return undefined
                            }

                            return <AssetPreview key={index} asset={asset} />
                        })
                    }
                </div>
            }
        </div>
    )
}
