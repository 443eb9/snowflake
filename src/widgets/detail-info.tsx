import { useContext, useEffect, useState } from "react"
import { Input, Text, useToastController } from "@fluentui/react-components"
import { List, ListItem } from "@fluentui/react-list-preview"
import TagsContainer from "../widgets/tags-container"
import { Asset, GetAsset, GetAssetAbsPath, ModifySrcOf } from "../backend"
import { browsingFolderContext, selectedItemsContext } from "../helpers/context-provider"
import { formatFileSize } from "../util"
import { darkenContentStyleHook } from "../helpers/styling"
import { t } from "../i18n"
import ErrToast from "./toasts/err-toast"
import { GlobalToasterId } from "../main"
import AssetImage from "./asset-image"

export default function DetailInfo() {
    const [asset, setAsset] = useState<Asset | undefined>()
    const [selectedCount, setSelectedCount] = useState(0)
    const [assetAbsPath, setAssetAbsPath] = useState<string | undefined>()
    const darkenContentStyle = darkenContentStyleHook()

    const [newSrc, setNewSrc] = useState("")

    const selectedItems = useContext(selectedItemsContext)
    const browsingFolder = useContext(browsingFolderContext)

    const atRecycleBin = browsingFolder?.data?.subTy == "recycleBin"

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        const selectedCount = selectedItems?.data?.length ?? 0
        setSelectedCount(selectedCount)
        if (!selectedItems?.data || selectedCount == 0) {
            setAsset(undefined)
            return
        }

        const selected = selectedItems.data[0]
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
                            readOnly={atRecycleBin}
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
