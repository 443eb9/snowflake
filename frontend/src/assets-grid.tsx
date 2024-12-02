import { useEffect, useState } from "react"
import { main } from "../wailsjs/go/models"
import { GetFolderRef } from "../wailsjs/go/main/App"
import AssetPreview from "./widgets/asset-preview"
import { Breadcrumb, BreadcrumbButton, BreadcrumbDivider, BreadcrumbItem } from "@fluentui/react-components"

export default function AssetsGrid({ id, setSelectedAsset }: { id?: string, setSelectedAsset: (id: string) => void }) {
    const [folder, setFolder] = useState<main.FolderRef | undefined>()

    useEffect(() => {
        if (folder && folder.meta.id == id) { return }
        async function fetch() {
            const folder = await GetFolderRef(id)
                .catch(err => {
                    // TODO error handling
                    console.log(err)
                })

            setFolder(folder ?? undefined)
        }

        fetch()
    }, [id])

    if (!folder) {
        return <></>
    }

    return (
        <div className="flex flex-col gap-2 h-full">
            <Breadcrumb>
                <BreadcrumbItem>
                    <BreadcrumbButton>
                        Library Root
                    </BreadcrumbButton>
                </BreadcrumbItem>
                {
                    folder.src.split("/").map((seg, index) =>
                        <>
                            <BreadcrumbDivider key={index} />
                            <BreadcrumbItem key={index}>
                                <BreadcrumbButton>
                                    {seg}
                                </BreadcrumbButton>
                            </BreadcrumbItem>
                        </>
                    )
                }
            </Breadcrumb>
            <div className="flex flex-wrap gap-2 max-h-full overflow-y-auto">
                {
                    folder.data.map((asset, index) => {
                        if (asset.meta.type < 1) {
                            return undefined
                        }

                        return <AssetPreview key={index} asset={asset} selectionCallback={setSelectedAsset} />
                    })
                }
            </div>
        </div>
    )
}
