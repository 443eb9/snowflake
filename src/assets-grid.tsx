import { useContext, useEffect, useState } from "react"
import AssetPreview from "./widgets/asset-preview"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem } from "@fluentui/react-components"
import { Asset, GetAssets } from "./backend"
import { browsingFolderContext, selectedAssetContext } from "./app"

export default function AssetsGrid() {
    const [assets, setAssets] = useState<Asset[] | undefined>()

    const browsingFolder = useContext(browsingFolderContext)
    const selectedAsset = useContext(selectedAssetContext)

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

    if (!assets || !browsingFolder?.data) {
        return <></>
    }

    const pathSegs = browsingFolder.data.path.replaceAll("\\", "/").split("/")

    return (
        <div className="flex w-full flex-col gap-2 h-full">
            <Breadcrumb>
                {
                    pathSegs.map((seg, index) =>
                        <>
                            <BreadcrumbItem key={index * 2}>
                                <BreadcrumbButton>
                                    {seg}
                                </BreadcrumbButton>
                            </BreadcrumbItem>
                            {index != pathSegs.length - 1 && <BreadcrumbDivider key={index * 2 + 1} />}
                        </>
                    )
                }
            </Breadcrumb>
            <div className="flex w-full flex-wrap gap-2 max-h-full overflow-y-auto">
                {
                    assets.map((asset, index) => {
                        if (asset.ty != "Image") {
                            return undefined
                        }

                        return <AssetPreview key={index} asset={asset} selectionCallback={(id) => selectedAsset?.setter(id)} />
                    })
                }
            </div>
        </div>
    )
}
