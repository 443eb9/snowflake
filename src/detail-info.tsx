import { useContext, useEffect, useState } from "react"
import { Button, Image, mergeClasses, Text } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "./widgets/tags-container"
import { getCurrentWindow, PhysicalSize } from "@tauri-apps/api/window"
import { Asset, ComputeChecksum, GetAsset, GetAssetAbsPath } from "./backend"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectedAssetsContext } from "./context-provider"
import formatFileSize from "./util"
import { darkenContentStyleHook } from "./styling"

export default function DetailInfo() {
    const [asset, setAsset] = useState<Asset | undefined>()
    const [assetAbsPath, setAssetAbsPath] = useState<string | undefined>()
    const [windowSize, setWindowSize] = useState<PhysicalSize | undefined>()
    const darkenContentStyle = darkenContentStyleHook()

    const selectedAssets = useContext(selectedAssetsContext)
    const selected = selectedAssets?.data?.entries().next().value
    const selectedCount = selectedAssets?.data?.size ?? 0

    useEffect(() => {
        if (!selected || selectedAssets?.data?.size != 1) {
            setAsset(undefined)
            return
        }

        if (asset && asset.id == selected[0]) { return }

        async function fetch() {
            if (!selected) { return }

            const asset = await GetAsset({ asset: selected[0] })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            const absPath = await GetAssetAbsPath({ asset: selected[0] })
                .catch(err => {
                    console.error(err)
                })

            if (asset && absPath) {
                setAsset(asset)
                setAssetAbsPath(absPath)
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
        } else if (asset && assetAbsPath) {
            return (
                <>
                    <Image
                        className="w-full"
                        src={convertFileSrc(assetAbsPath)}
                        shape="rounded"
                        shadow
                    />
                    <List className="flex flex-col gap-2">
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">File Name</Text>
                            <Text>{asset.name}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="bold">Tags</Text>
                            <TagsContainer
                                tags={asset.tags}
                                associatedItem={asset.id}
                            />
                        </ListItem>
                    </List>
                    <List className={darkenContentStyle.root}>
                        <ListItem>
                            <Text as="h5" size={500} weight="bold" font="monospace">File Properties</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Size</Text>
                            <Text font="monospace">{formatFileSize(asset.meta.byte_size)}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Created At</Text>
                            <Text font="monospace">{new Date(asset.meta.created_at).toLocaleString()}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Last Modified</Text>
                            <Text font="monospace">{new Date(asset.meta.last_modified).toLocaleString()}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Id</Text>
                            <Text font="monospace">{asset.id}</Text>
                        </ListItem>
                        <ListItem className="flex flex-col gap-1">
                            <Text weight="semibold" font="monospace">Checksums</Text>
                            {
                                asset.checksums
                                    ? <div className={mergeClasses("w-full flex flex-col overflow-x-auto", darkenContentStyle.root)}>
                                        <Text font="monospace">[CRC32]{asset.checksums.crc32}</Text>
                                        <Text font="monospace">[MD5]{asset.checksums.md5}</Text>
                                        <Text font="monospace">[SHA1]{asset.checksums.sha1}</Text>
                                        <Text font="monospace">[SHA256]{asset.checksums.sha256}</Text>
                                    </div>
                                    : <Button onClick={async () => {
                                        const computed = await ComputeChecksum({ asset: asset.id })
                                            .catch(err => {
                                                // TODO error handling
                                                console.error(err)
                                            })

                                        if (computed) {
                                            setAsset(computed)
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
