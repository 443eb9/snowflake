import { useContext, useEffect } from "react"
import { browsingFolderContext, fileManipulationContext, selectedItemsContext } from "./context-provider"
import { CreateCollections, CreateTags, DeleteAssets, DeleteCollections, DeleteTags, GetAllAssets, GetAllUncategorizedAssets, GetAssetsContainingTag, GetRecycleBin, ImportAssets, ItemId, ItemTy, MoveCollectionsTo, MoveTagsTo, RecolorCollection, RecoverAssets, RegroupTag, RenameItem } from "../backend"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/toasts/err-toast"
import MsgToast from "../widgets/toasts/msg-toast"
import DuplicationList from "../widgets/duplication-list"
import { t } from "../i18n"
import { decodeId } from "../util"
import { SelectedClassTag } from "../widgets/items-grid"

export default function FileManipulator() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    async function handleAssetDeletion(
        assets: string[],
        permanently: boolean,
    ) {
        if (!browsingFolder?.data || !selectedItems?.data) {
            return
        }

        browsingFolder.setter({
            ...browsingFolder.data,
            content: [...browsingFolder.data.content.filter(id => selectedItems.data?.find(selected => selected.id == id.id) == undefined)]
        })
        await DeleteAssets({ assets, permanently })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedItems.setter([])
    }

    async function handleAssetRename(
        newName: string,
        asset: string,
    ) {
        if (!browsingFolder?.data || !selectedItems?.data || selectedItems.data.length != 1) {
            return
        }
        await RenameItem({ item: { id: asset, ty: "asset" }, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedItems.setter([])
        browsingFolder.setter({
            ...browsingFolder.data,
        })
    }

    async function handleAssetsImport(
        items: string[],
        parent: string | null,
    ) {
        if (!browsingFolder?.data) { return }
        const dup = await ImportAssets({ initialTag: parent, path: items })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        let assets;
        switch (browsingFolder.data.subTy) {
            case "tag":
                if (browsingFolder.data.id) {
                    assets = await GetAssetsContainingTag({ tag: browsingFolder.data.id })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
            case "uncategorized":
                assets = await GetAllUncategorizedAssets()
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                break
            case "all":
                assets = await GetAllAssets()
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                break
        }
        if (!assets) { return }

        browsingFolder?.setter({
            ...browsingFolder.data,
            content: assets.map(a => { return { id: a, ty: "asset" } }),
        })

        if (dup) {
            dispatchToast(<MsgToast
                title={t("toast.assetDuplication.title")}
                body={<DuplicationList list={dup} />}
            />,
                { intent: "warning" }
            )
        }
    }

    async function handleFolderAlikeRename(
        targetId: ItemId,
        newName: string,
    ) {
        await RenameItem({ item: targetId, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (targetId.id == browsingFolder?.data?.id) {
            browsingFolder.setter(undefined)
            selectedItems?.setter([])
        }
    }

    async function handleFolderAlikeMove(
        moved: string[],
        target: string,
        ty: ItemTy,
    ) {
        switch (ty) {
            case "collection":
                await MoveCollectionsTo({ srcCollections: moved, dstCollection: target })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                break
            case "tag":
                await MoveTagsTo({ srcTags: moved, dstCollection: target })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                break
        }

        selectedItems?.setter(selectedItems.data?.filter(a => !moved.includes(a.id)))
    }

    // Collections

    async function handleCollectionDeletion(
        targetIds: string[],
    ) {
        await DeleteCollections({ collections: targetIds })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder?.data?.id && targetIds.includes(browsingFolder.data?.id)) {
            browsingFolder.setter(undefined)
            selectedItems?.setter([])
        }
    }

    async function handleCollectionCreation(
        newNames: string[],
        parent: string,
    ) {
        await CreateCollections({ collectionNames: newNames, parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
    }

    async function handleCollectionRecolor(
        targetId: string,
        color: string,
    ) {
        await RecolorCollection({ collection: targetId, color: color.length == 0 ? null : color })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
    }

    // Tags

    async function handleTagCreation(
        newNames: string[],
        parent: string,
    ) {
        await CreateTags({ tagNames: newNames, parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
    }

    async function handleTagDeletion(
        targetIds: string[],
    ) {
        await DeleteTags({ tags: targetIds })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder?.data?.id && targetIds.includes(browsingFolder.data?.id)) {
            browsingFolder.setter(undefined)
            selectedItems?.setter([])
        }
    }

    async function handleTagRegroup(
        targetId: string,
        group: string,
    ) {
        await RegroupTag({ tag: targetId, group: group.length == 0 ? null : group })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (targetId == browsingFolder?.data?.id) {
            const assets = await GetAssetsContainingTag({ tag: targetId })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (assets) {
                browsingFolder.setter({
                    id: targetId,
                    name: "",
                    content: assets.map(a => { return { id: a, ty: "asset" } }),
                    subTy: "tag",
                })
                selectedItems?.setter([])
            }
        }
    }

    async function handleAssetsRecover(assets: string[]) {
        if (selectedItems?.data && browsingFolder?.data) {
            await RecoverAssets({ assets })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            const recycleBin = await GetRecycleBin()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (recycleBin) {
                selectedItems.setter([])
                browsingFolder.setter({
                    ...browsingFolder.data,
                    content: recycleBin,
                })

                // update folder tree
                fileManipulation?.setter({
                    id: [],
                    op: "create",
                    submit: [],
                })
            }
        }
    }

    useEffect(() => {
        const data = fileManipulation?.data
        if (data?.submit == undefined) { return }

        if (data.id.length > 0 && data.op == "recover") {
            handleAssetsRecover(data.id.map(id => id.id))
        }

        const assets = data.id.filter(id => id.ty == "asset").map(id => id.id)
        const collections = data.id.filter(id => id.ty == "collection").map(id => id.id)
        const tags = data.id.filter(id => id.ty == "tag").map(id => id.id)

        if (assets.length > 0) {
            switch (data.op) {
                case "rename": handleAssetRename(data.submit[0], assets[0]); break
                case "deletion": handleAssetDeletion(assets, false); break
                case "deletionPermanent": handleAssetDeletion(assets, true); break
                case "create": console.error("Creating an asset is invalid."); break
            }
        }

        if (collections.length > 0) {
            switch (data.op) {
                case "rename": handleFolderAlikeRename({ id: collections[0], ty: "collection" }, data.submit[0]); break
                case "deletion":
                case "deletionPermanent": handleCollectionDeletion(collections); break
                case "create":
                    if (data.submit.length < 2) { break }
                    if (data.submit[1] == "collection") {
                        handleCollectionCreation([data.submit[0]], collections[0]);
                    } else if (data.submit[1] == "tag") {
                        handleTagCreation([data.submit[0]], collections[0]);
                    }
                    break
                case "move": handleFolderAlikeMove(collections, data.submit[0], "collection"); break
                case "recolor": handleCollectionRecolor(collections[0], data.submit[0]); break
            }
        }

        if (tags.length > 0) {
            switch (data.op) {
                case "rename": handleFolderAlikeRename({ id: tags[0], ty: "tag" }, data.submit[0]); break
                case "deletion":
                case "deletionPermanent": handleTagDeletion(tags); break
                case "move": handleFolderAlikeMove(tags, data.submit[0], "tag"); break
                case "import": handleAssetsImport(data.submit, tags[0].length == 0 ? null : tags[0]); break
                case "regroup": handleTagRegroup(tags[0], data.submit[0]); break
            }
        }

        fileManipulation?.setter(undefined)
    }, [fileManipulation?.data])

    useEffect(() => {
        document.querySelectorAll(`.${SelectedClassTag}`)
            .forEach(elem => {
                if (selectedItems?.data?.find(selected => selected.id == decodeId(elem.id).id) == undefined) {
                    elem.classList.remove(SelectedClassTag)
                }
            })
    }, [selectedItems?.data])

    return <></>
}
