import { useEffect, useState } from "react"
import { main } from "../wailsjs/go/models"
import { GetAbsPath, GetAssetRef } from "../wailsjs/go/main/App"
import { Image, Text } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import { Size, WindowGetSize } from "../wailsjs/runtime/runtime"
import TagsContainer from "./widgets/tags-container"

export default function DetailInfo({ id }: { id?: string }) {
    const [asset, setAsset] = useState<main.AssetRef & { absPath: string }>()
    const [windowSize, setWindowSize] = useState<Size | undefined>()

    useEffect(() => {
        async function setWindowSizeAsync() {
            await WindowGetSize()
                .then(size => setWindowSize(size))
        }
        setWindowSizeAsync()

        if (asset && asset.meta.id == id) { return }
        async function fetch() {
            const asset = await GetAssetRef(id)
                .then(async asset => {
                    const absPath = await GetAbsPath(asset.src)
                    return {
                        absPath,
                        ...asset
                    }
                })
                .catch(err => {
                    // TODO error handling
                })

            // @ts-ignore
            setAsset(asset)
        }

        fetch()
    }, [id, windowSize])

    if (!asset || !windowSize || !id) {
        return <></>
    }

    return (
        // TODO better approach to set width?
        <div className="flex flex-col gap-2 h-full overflow-y-auto" style={{ width: `${windowSize.w * 0.2}px` }}>
            <Text as="h2" align="end" size={500}>File Detail</Text>
            <Image
                className="w-full"
                src={asset.src}
                shape="rounded"
                shadow
            />
            <List className="flex flex-col gap-2">
                <ListItem className="flex flex-col gap-1">
                    <Text weight="bold">File Name</Text>
                    <Text>{asset.meta.name}</Text>
                </ListItem>
                <ListItem className="flex flex-col gap-1">
                    <Text weight="bold">Tags</Text>
                    <TagsContainer
                        tags={asset.tags}
                        associatedItem={asset.meta.id}
                        itemType={asset.meta.type}
                    />
                </ListItem>
                <ListItem className="flex flex-col gap-1">
                    <Text weight="bold">Full Path</Text>
                    <Text>{asset.absPath}</Text>
                </ListItem>
                <ListItem className="flex flex-col gap-1">
                    <Text weight="bold">Last Modified</Text>
                    <Text>{new Date(asset.meta.modified_at).toLocaleString()}</Text>
                </ListItem>
            </List>
        </div>
    )
}
