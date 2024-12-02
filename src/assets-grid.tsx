import { useContext, useEffect, useState } from "react"
import AssetPreview from "./widgets/asset-preview"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem } from "@fluentui/react-components"
import { Asset, Folder, GetAssetsAt, GetFolder } from "./backend"
import { browsingFolderContext, selectedAssetContext } from "./app"

export default function AssetsGrid() {
    const [folder, setFolder] = useState<Folder | undefined>()
    const [assets, setAssets] = useState<Asset[] | undefined>()

    const browsingFolder = useContext(browsingFolderContext)
    const selectedAsset = useContext(selectedAssetContext)

    useEffect(() => {
        if (folder && folder.meta.id == browsingFolder?.data) { return }
        async function fetch() {
            if (!browsingFolder?.data) {
                setFolder(undefined)
                setAssets(undefined)
                return
            }

            const assets = await GetAssetsAt({ folder: browsingFolder.data })
                .catch(err => {
                    // TODO error handling
                    console.log(err)
                })

            if (assets) {
                setAssets(assets)
                const folder = await GetFolder({ folder: browsingFolder.data })
                setFolder(folder)
            }
        }

        fetch()
    }, [browsingFolder, selectedAsset])

    if (!folder || !assets) {
        return <></>
    }

    const pathSegs = folder.path.replaceAll("\\", "/").split("/")

    return (
        <div className="flex flex-col gap-2 h-full">
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
            <div className="flex flex-wrap gap-2 max-h-full overflow-y-auto">
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
