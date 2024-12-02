import { useEffect, useState } from "react"
import AssetPreview from "./widgets/asset-preview"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem } from "@fluentui/react-components"
import { Asset, Folder, GetAssetsAt, GetFolder } from "./backend"

export default function AssetsGrid({ id, setSelectedAsset }: { id?: string, setSelectedAsset: (id: string) => void }) {
    const [folder, setFolder] = useState<Folder | undefined>()
    const [assets, setAssets] = useState<Asset[] | undefined>()

    useEffect(() => {
        if (folder && folder.meta.id == id) { return }
        async function fetch() {
            if (!id) {
                setFolder(undefined)
                setAssets(undefined)
                return
            }

            const assets = await GetAssetsAt({ folder: id })
                .catch(err => {
                    // TODO error handling
                    console.log(err)
                })

            if (assets) {
                setAssets(assets)
                const folder = await GetFolder({ folder: id })
                setFolder(folder)
            }
        }

        fetch()
    }, [id])

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

                        return <AssetPreview key={index} asset={asset} selectionCallback={setSelectedAsset} />
                    })
                }
            </div>
        </div>
    )
}
