import { useContext, useEffect, useState } from "react"
import { Image, Input, Text, useToastController } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "../widgets/tags-container"
import { Asset, GetAsset, GetAssetAbsPath, ModifySrcOf } from "../backend"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectedObjectsContext } from "../helpers/context-provider"
import { formatFileSize } from "../util"
import { darkenContentStyleHook } from "../helpers/styling"
import { t } from "../i18n"
import ErrToast from "./err-toast"
import { GlobalToasterId } from "../main"

export default function DetailInfo() {
    const [asset, setAsset] = useState<Asset | undefined>()
    const [selectedCount, setSelectedCount] = useState(0)
    const [assetAbsPath, setAssetAbsPath] = useState<string | undefined>()
    const darkenContentStyle = darkenContentStyleHook()

    const [newSrc, setNewSrc] = useState("")

    const selectedObjects = useContext(selectedObjectsContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        if (!selectedObjects?.data) {
            setAsset(undefined)
            return
        }

        setSelectedCount(selectedObjects.data.length)
        if (selectedObjects.data.length != 1) {
            setAsset(undefined)
            return
        }

        const selected = selectedObjects.data[0]
        if (asset && asset.id == selected.id) { return }

        async function fetch() {
            const asset = await GetAsset({ asset: selected.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const absPath = await GetAssetAbsPath({ asset: selected.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (asset && absPath) {
                setAsset(asset)
                setNewSrc(asset.src)
                setAssetAbsPath(absPath)
            }
        }

        if (selected.ty == "asset") {
            fetch()
        }
    }, [selectedObjects?.data])

    if (selectedCount != 1) {
        return (
            <Text className="opacity-50" size={600} italic>
                {selectedCount == 0 ? t("detail.noAssetSelect") : t("detail.multiAssetsSelect")}
            </Text>
        )
    } else if (selectedObjects?.data && selectedObjects?.data.length > 0 && selectedObjects?.data[0].ty == "folder") {
        return (
            <Text className="opacity-50" size={600} italic>
                {t("detail.folderSelect")}
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
                        <Text weight="bold">{t("detail.fileName")}</Text>
                        <Text>{asset.name}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col gap-1">
                        <Text weight="bold">{t("detail.src")}</Text>
                        <Input
                            size="small"
                            appearance="underline"
                            value={newSrc}
                            onChange={ev => setNewSrc(ev.currentTarget.value)}
                            onKeyDown={async ev => {
                                if (ev.key == "Enter") {
                                    ev.currentTarget.blur()
                                    await ModifySrcOf({ asset: asset.id, src: newSrc })
                                        .catch(err => <ErrToast body={err} />)
                                }
                            }}
                        />
                    </ListItem>
                    <ListItem className="flex flex-col gap-1">
                        <Text weight="bold">{t("detail.tags")}</Text>
                        <TagsContainer
                            tags={asset.tags}
                            associatedItem={asset.id}
                        />
                    </ListItem>
                </List>
                <List className={darkenContentStyle.root}>
                    <ListItem>
                        <Text as="h5" size={500} weight="bold" font="monospace">{t("detail.filePropsSectionTitle")}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col">
                        <Text weight="semibold" font="monospace">{t("detail.size")}</Text>
                        <Text font="monospace">{formatFileSize(asset.meta.byteSize)}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col">
                        <Text weight="semibold" font="monospace">{t("detail.ext")}</Text>
                        <Text font="monospace">{asset.ext}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col">
                        <Text weight="semibold" font="monospace">{t("detail.created")}</Text>
                        <Text font="monospace">{new Date(asset.meta.createdAt).toLocaleString()}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col">
                        <Text weight="semibold" font="monospace">{t("detail.modify")}</Text>
                        <Text font="monospace">{new Date(asset.meta.lastModified).toLocaleString()}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col">
                        <Text weight="semibold" font="monospace">{t("detail.id")}</Text>
                        <Text font="monospace">{asset.id}</Text>
                    </ListItem>
                </List>
            </>
        )
    }
}
