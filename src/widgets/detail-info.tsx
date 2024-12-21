import { useContext, useEffect, useState } from "react"
import { Text, useToastController } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "../widgets/tags-container"
import { Asset, GetAsset, GetAssetAbsPath, GetRemovedAsset, GetTagsOnAsset, ModifySrcOf } from "../backend"
import { browsingFolderContext, selectedItemsContext } from "../helpers/context-provider"
import { formatFileSize } from "../util"
import { darkenContentStyleHook } from "../helpers/styling"
import { t } from "../i18n"
import ErrToast from "./toasts/err-toast"
import { GlobalToasterId } from "../main"
import AssetImage from "./asset-image"
import ResponsiveInput from "../components/responsive-input"

export default function DetailInfo() {
    const [asset, setAsset] = useState<Asset & { tags: string[] } | undefined>()
    const [selectedCount, setSelectedCount] = useState(0)
    const [assetAbsPath, setAssetAbsPath] = useState<string | undefined>()
    const darkenContentStyle = darkenContentStyleHook()

    const [newSrc, setNewSrc] = useState("")

    const selectedItems = useContext(selectedItemsContext)
    const browsingFolder = useContext(browsingFolderContext)

    const atRecycleBin = browsingFolder?.data?.subTy == "recycleBin"

    const { dispatchToast } = useToastController(GlobalToasterId)

    const fetchAsset = async () => {
        const selectedCount = selectedItems?.data?.length ?? 0
        setSelectedCount(selectedCount)
        if (!selectedItems?.data || selectedCount == 0) {
            setAsset(undefined)
            return
        }

        const selected = selectedItems.data[0]
        if (!browsingFolder?.data) { return }

        const ty = browsingFolder.data.subTy
        const asset = await (ty == "recycleBin" ? GetRemovedAsset({ asset: selected.id }) : GetAsset({ asset: selected.id }))
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        const absPath = await GetAssetAbsPath({ asset: selected.id })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        const tags = await GetTagsOnAsset({ asset: selected.id })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (asset && absPath && tags) {
            setAsset({ ...asset, tags })
            setNewSrc(asset.src)
            setAssetAbsPath(absPath)
        }
    }

    useEffect(() => {
        fetchAsset()
    }, [selectedItems?.data])

    if (selectedCount != 1) {
        return (
            <Text className="opacity-50" size={600} italic>
                {selectedCount == 0 ? t("detail.noAssetSelect") : t("detail.multiAssetsSelect")}
            </Text>
        )
    } else if (asset && assetAbsPath) {
        return (
            <>
                <AssetImage className="w-full" asset={asset} />
                <List className="flex flex-col gap-2">
                    <ListItem className="flex flex-col gap-1">
                        <Text weight="bold">{t("detail.fileName")}</Text>
                        <Text>{asset.name}</Text>
                    </ListItem>
                    <ListItem className="flex flex-col gap-1">
                        <Text weight="bold">{t("detail.src")}</Text>
                        <ResponsiveInput
                            size="small"
                            appearance="underline"
                            value={newSrc}
                            readOnly={atRecycleBin}
                            onChange={ev => setNewSrc(ev.currentTarget.value)}
                            onConfirm={async target => {
                                await ModifySrcOf({ asset: asset.id, src: target.value })
                                    .catch(err => <ErrToast body={err} />)
                                fetchAsset()
                            }}
                            onCancel={target => target.value = asset.src}
                        />
                    </ListItem>
                    <ListItem className="flex flex-col gap-1">
                        <Text weight="bold">{t("detail.tags")}</Text>
                        <TagsContainer
                            tags={asset.tags}
                            associatedItem={asset.id}
                            readonly={atRecycleBin}
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
                    {
                        Object
                            .entries(asset.props)
                            .filter(([name, _]) => !["cacheCamera"].includes(name))
                            .map(([name, value]) =>
                                <ListItem className="flex flex-col">
                                    <Text weight="semibold" font="monospace">{t(`detail.${name}`)}</Text>
                                    <Text font="monospace">{value.toString()}</Text>
                                </ListItem>
                            )
                    }
                </List>
            </>
        )
    }
}
