import { useContext, useEffect, useState } from "react"
import { Image, Text, useToastController } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "../widgets/tags-container"
import { Asset, GetAsset, GetAssetAbsPath } from "../backend"
import { convertFileSrc } from "@tauri-apps/api/core"
import { selectedAssetsContext } from "../helpers/context-provider"
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

    const selectedAssets = useContext(selectedAssetsContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        if (!selectedAssets?.data) {
            setAsset(undefined)
            return
        }

        setSelectedCount(selectedAssets.data.length)
        if (selectedAssets.data.length != 1) {
            setAsset(undefined)
            return
        }

        const selected = selectedAssets.data[0]
        if (asset && asset.id == selected) { return }

        async function fetch() {
            const asset = await GetAsset({ asset: selected })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            const absPath = await GetAssetAbsPath({ asset: selected })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (asset && absPath) {
                setAsset(asset)
                setAssetAbsPath(absPath)
            }
        }

        fetch()
    }, [selectedAssets?.data])

    if (selectedCount != 1) {
        return (
            <Text className="opacity-50" size={600} italic>
                {selectedCount == 0 ? t("detail.noAssetSelect") : t("detail.multiAssetsSelect")}
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
