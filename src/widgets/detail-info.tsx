import { useContext, useEffect, useState } from "react"
import { useToastController } from "@fluentui/react-components"
import TagsContainer from "../widgets/tags-container"
import { Asset, GetAssetAbsPath, GetAssets, GetRemovedAssets, GetTagsOnAsset, ModifySrcOf } from "../backend"
import { browsingFolderContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider"
import { formatFileSize, isAtRecycleBin } from "../util"
import { t } from "../i18n"
import ErrToast from "./toasts/err-toast"
import { GlobalToasterId } from "../main"
import ItemImage from "./asset-image"
import ResponsiveInput from "../components/responsive-input"
import FallbackableText from "../components/fallbackable-text"
import KeyValueList from "../components/key-value-list"

export default function DetailInfo() {
    const [asset, setAsset] = useState<Asset & { tags: string[] } | undefined>()
    const [selectedCount, setSelectedCount] = useState(0)
    const [assetAbsPath, setAssetAbsPath] = useState<string | undefined>()

    const [newSrc, setNewSrc] = useState("")
    const [newName, setNewName] = useState("")

    const selectedItems = useContext(selectedItemsContext)
    const browsingFolder = useContext(browsingFolderContext)
    const fileManipulation = useContext(fileManipulationContext)

    const atRecycleBin = browsingFolder?.data?.subTy == "recycleBinAssets"

    const { dispatchToast } = useToastController(GlobalToasterId)

    const fetchAsset = async () => {
        const selectedCount = selectedItems?.data?.length ?? 0
        setSelectedCount(selectedCount)
        if (!selectedItems?.data || selectedCount == 0) {
            setAsset(undefined)
            return
        }

        const selected = selectedItems.data[0]
        if (!browsingFolder?.data || selected.ty != "asset") { return }

        const ty = browsingFolder.data.subTy
        const asset = await (isAtRecycleBin(ty) ? GetRemovedAssets({ assets: [selected.id] }) : GetAssets({ assets: [selected.id] }))
            .then(assets => assets.length == 1 ? assets[0] : undefined)
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        const absPath = await GetAssetAbsPath({ asset: selected.id })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        const tags = await GetTagsOnAsset({ asset: selected.id })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (asset && absPath && tags) {
            setAsset({ ...asset, tags })
            setNewSrc(asset.src)
            setNewName(asset.name)
            setAssetAbsPath(absPath)
        }
    }

    useEffect(() => {
        fetchAsset()
    }, [selectedItems?.data])

    if (selectedCount != 1) {
        return (
            <FallbackableText
                size={600}
                fallback={selectedCount == 0 ? t("detail.noAssetSelect") : t("detail.multiAssetsSelect")}
            />
        )
    } else if (asset && assetAbsPath) {
        return (
            <div className="flex flex-col gap-8">
                <ItemImage className="w-full" item={{ ty: "asset", data: asset }} />
                <KeyValueList
                    items={[
                        {
                            key: t("detail.fileName"),
                            value:
                                <ResponsiveInput
                                    appearance="underline"
                                    value={newName}
                                    readOnly={atRecycleBin}
                                    onChange={ev => setNewName(ev.currentTarget.value)}
                                    onConfirm={async target => {
                                        fileManipulation?.setter({
                                            id: [{ id: asset.id, ty: "asset" }],
                                            op: "rename",
                                            submit: [target.value],
                                        })
                                        fetchAsset()
                                    }}
                                    onCancel={target => target.value = asset.src}
                                    style={{ width: "100%" }}
                                />,
                            vertical: true,
                        },
                        {
                            key: t("detail.src"),
                            value:
                                <ResponsiveInput
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
                                    style={{ width: "100%" }}
                                />,
                            vertical: true,
                        },
                        {
                            key: t("detail.tags"),
                            value:
                                <TagsContainer
                                    tags={asset.tags}
                                    associatedItem={asset.id}
                                    readonly={atRecycleBin}
                                />,
                            vertical: true,
                        },
                    ]}
                />
                <KeyValueList
                    items={[
                        { key: t("detail.size"), value: formatFileSize(asset.meta.byteSize) },
                        { key: t("detail.ext"), value: asset.ext },
                        { key: t("detail.created"), value: new Date(asset.meta.createdAt).toLocaleString() },
                        { key: t("detail.modify"), value: new Date(asset.meta.lastModified).toLocaleString() },
                        { key: t("detail.id"), value: asset.id },
                    ].concat(
                        Object
                            .entries(asset.props)
                            .filter(([name, _]) => !["cacheCamera"].includes(name))
                            .map(([name, value]) => {
                                return {
                                    key: t(`detail.${name}`), value: value.toString()
                                }
                            })
                    )}
                />
            </div>
        )
    } else {
        return (
            <FallbackableText
                size={600}
                fallback={t("detail.notAvailable")}
            />
        )
    }
}
