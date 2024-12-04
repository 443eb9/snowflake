import { useContext, useEffect, useState } from "react"
import { Button, Image, mergeClasses, Text } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "./widgets/tags-container"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { AbsolutizePath, Asset, ComputeChecksum, GetAsset, GetTagsOf, Tag } from "./backend"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectedAssetsContext } from "./context-provider"
import formatFileSize from "./util"
import { darkenContentStyleHook } from "./styling"

type TaggedAsset = {
    asset: Asset,
    tags: Tag[],
    absPath: string,
}

export default function DetailInfo() {
    const [tagged, setTagged] = useState<TaggedAsset | undefined>()
    const [windowSize, setWindowSize] = useState<PhysicalSize | undefined>()
    const darkenContentStyle = darkenContentStyleHook()

    const selectedAssets = useContext(selectedAssetsContext)
    const selected = selectedAssets?.data?.entries().next().value
    const selectedCount = selectedAssets?.data?.size ?? 0

    useEffect(() => {
        if (!selected || selectedAssets?.data?.size != 1) {
            setTagged(undefined)
            return
        }

        if (tagged && tagged.asset.relative_path == selected[0]) { return }

        async function fetch() {
            if (!selected) { return }

            const asset = await GetAsset({ asset: selected[0] })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            const absPath = await AbsolutizePath({ path: selected[0] })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            const tags = await GetTagsOf({ asset: selected[0] })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (asset && tags && absPath) {
                setTagged({ asset, tags, absPath })
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
                        src={convertFileSrc(tagged.absPath)}
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
                                associatedItem={tagged.asset.relative_path}
                            />
                        </ListItem>
                    </List>
                    <List className={darkenContentStyle.root}>
                        <ListItem>
                            <Text as="h5" size={500} weight="bold" font="monospace">File Properties</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Full Path</Text>
                            <Text font="monospace">{tagged.absPath}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Size</Text>
                            <Text font="monospace">{formatFileSize(tagged.asset.meta.byte_size)}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Created At</Text>
                            <Text font="monospace">{new Date(tagged.asset.meta.created_at).toLocaleString()}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Last Modified</Text>
                            <Text font="monospace">{new Date(tagged.asset.meta.last_modified).toLocaleString()}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Checksums</Text>
                            {
                                tagged.asset.checksums
                                    ? <div className={mergeClasses("w-full flex flex-col overflow-x-auto", darkenContentStyle.root)}>
                                        <Text font="monospace">[CRC32]{tagged.asset.checksums.crc32}</Text>
                                        <Text font="monospace">[MD5]{tagged.asset.checksums.md5}</Text>
                                        <Text font="monospace">[SHA1]{tagged.asset.checksums.sha1}</Text>
                                        <Text font="monospace">[SHA256]{tagged.asset.checksums.sha256}</Text>
                                    </div>
                                    : <Button onClick={async () => {
                                        const computed = await ComputeChecksum({ asset: tagged.asset.relative_path })
                                            .catch(err => {
                                                // TODO error handling
                                                console.error(err)
                                            })

                                        if (computed) {
                                            console.log(computed.checksums)
                                            setTagged({
                                                ...tagged,
                                                asset: computed,
                                            })
                                            console.log(tagged.asset.checksums)
                                        }
                                    }}>
                                        <Text>Compute</Text>
                                    </Button>
                            }
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
