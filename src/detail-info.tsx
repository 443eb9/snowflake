import { useContext, useEffect, useState } from "react"
import { Image, Text } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "./widgets/tags-container"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { Asset, GetAsset, GetTagsOf, Tag } from "./backend"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectedAssetContext } from "./context-provider"

type TaggedAsset = {
    asset: Asset,
    tags: Tag[]
}

export default function DetailInfo() {
    const [tagged, setTagged] = useState<TaggedAsset | undefined>()
    const [windowSize, setWindowSize] = useState<PhysicalSize | undefined>()

    const selectedAsset = useContext(selectedAssetContext)

    useEffect(() => {
        if (!selectedAsset?.data) {
            setTagged(undefined)
            return
        }

        if (selectedAsset?.data && tagged && tagged.asset.meta.id == selectedAsset.data) { return }
        async function fetch() {
            const asset = await GetAsset({ asset: selectedAsset?.data as string })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            const tags = await GetTagsOf({ asset: selectedAsset?.data as string })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (asset && tags) {
                setTagged({ asset, tags })
            }
        }

        fetch()
    }, [selectedAsset])

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

    return (
        // TODO better approach to set width?
        <div className="flex flex-col gap-2 h-full overflow-y-auto p-1" style={{ width: `${windowSize.width * 0.15}px` }}>
            {
                tagged
                    ? <>
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
                                <Text weight="bold">Last Modified</Text>
                                <Text>{new Date(tagged.asset.meta.last_modified).toLocaleString()}</Text>
                            </ListItem>
                        </List>
                    </>
                    : <Text className="opacity-50" size={600} italic>No asset selected</Text>
            }
        </div>
    )
}
