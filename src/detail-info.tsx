import { useEffect, useState } from "react"
import { Image, Text } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "./widgets/tags-container"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { Asset, GetAsset, GetTagsOf, Tag } from "./backend"
import { convertFileSrc } from "@tauri-apps/api/core"

type TaggedAsset = {
    asset: Asset,
    tags: Tag[]
}

export default function DetailInfo({ id }: { id?: string }) {
    const [tagged, setTagged] = useState<TaggedAsset | undefined>()
    const [windowSize, setWindowSize] = useState<PhysicalSize | undefined>()

    useEffect(() => {
        if (tagged && tagged.asset.meta.id == id) { return }
        async function fetch() {
            if (!id) {
                setTagged(undefined)
                return
            }

            const asset = await GetAsset({ asset: id })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            const tags = await GetTagsOf({ asset: id })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (asset && tags) {
                setTagged({ asset, tags })
            }
        }

        fetch()
    }, [id])

    useEffect(() => {
        async function setWindowSizeAsync() {
            const size = await getCurrentWindow().innerSize()
            setWindowSize(size)
        }
        setWindowSizeAsync()
    }, [windowSize])

    if (!tagged || !windowSize || !id) {
        return <></>
    }

    return (
        // TODO better approach to set width?
        <div className="flex flex-col gap-2 h-full overflow-y-auto" style={{ width: `${windowSize.width * 0.15}px` }}>
            <Text as="h2" align="end" size={500}>File Detail</Text>
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
        </div>
    )
}
