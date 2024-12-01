import { useEffect, useState } from "react"
import { main } from "../wailsjs/go/models"
import { GetFolderRef } from "../wailsjs/go/main/App"
import AssetPreview from "./widgets/asset-preview"

export default function AssetsGrid({ id, setSelectedAsset }: { id?: string, setSelectedAsset: (id: string) => void }) {
    const [folder, setFolder] = useState<main.FolderRef | undefined>()

    useEffect(() => {
        if (folder && folder.meta.id == id) { return }
        async function fetch() {
            const folder = await GetFolderRef(id)
                .catch(err => {
                    // TODO error handling
                })

            setFolder(folder ?? undefined)
        }

        fetch()
    }, [id])

    if (!folder) {
        return <></>
    }

    return (
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
    )
}
