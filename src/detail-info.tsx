import { useContext, useEffect, useState } from "react"
import { Image, Text } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "./widgets/tags-container"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { Asset, GetAsset, GetTagsOf, Tag } from "./backend"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectedAssetsContext } from "./context-provider"
import formatFileSize from "./util"

type TaggedAsset = {
    asset: Asset,
    tags: Tag[]
}

export default function DetailInfo() {
    const [tagged, setTagged] = useState<TaggedAsset | undefined>()
    const [windowSize, setWindowSize] = useState<PhysicalSize | undefined>()

    const selectedAssets = useContext(selectedAssetsContext)
    const selected = selectedAssets?.data?.entries().next().value
    const selectedCount = selectedAssets?.data?.size ?? 0

    useEffect(() => {
        if (!selected || selectedAssets?.data?.size != 1) {
            setTagged(undefined)
            return
        }

        if (tagged && tagged.asset.meta.id == selected[0]) { return }

        async function fetch() {
            if (!selected) { return }

            const asset = await GetAsset({ asset: selected[0] })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            const tags = await GetTagsOf({ asset: selected[0] })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (asset && tags) {
                setTagged({ asset, tags })
            }
        }

        fetch()
    }, [selected])

    useEffect(() => {
        async function setWindowSizeAsync() {
            const size = await getCurrentWindow().innerSize()
            setWindowSize(size)
        }
        setWindowSizeAsync()
    }, [windowSize])

    if (!windowSize) {
        return <></>
    }

    function getInfo() {
        if (selectedCount != 1) {
            return (
                <Text className="opacity-50" size={600} italic>
                    {selectedCount == 0 ? "No asset selected" : "Multiple assets selected"}
                </Text>
            )
        } else if (tagged) {
            return (
                <>
                    <Image
                        className="w-full"
                        src={convertFileSrc(tagged.asset.path)}
                        shape="rounded"
                        shadow
                    />
                    <List className="flex flex-col gap-2">
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">File Name</Text>
                            <Text>{tagged.asset.name}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">Tags</Text>
                            <TagsContainer
                                tags={tagged.tags}
                                associatedItem={tagged.asset.meta.id}
                            />
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">Full Path</Text>
                            <Text>{tagged.asset.path}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">Size</Text>
                            <Text>{formatFileSize(tagged.asset.meta.byte_size)}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">Created At</Text>
                            <Text>{new Date(tagged.asset.meta.created_at).toLocaleString()}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">Last Modified</Text>
                            <Text>{new Date(tagged.asset.meta.last_modified).toLocaleString()}</Text>
                        </ListItem>
                    </List>
                </>
            )
        }
    }

    return (
        // TODO better approach to set width?
        <div className="flex flex-col gap-2 h-full overflow-y-auto p-1" style={{ width: `${windowSize.width * 0.15}px` }}>
            {
                getInfo()
            }
        </div>
    )
}
