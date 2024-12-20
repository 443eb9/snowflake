import { useContext, useEffect } from "react"
import { browsingFolderContext, fileManipulationContext, selectedItemsContext } from "./context-provider"
import { CreateFolders, DeleteAssets, DeleteFolders, GetFolder, GetRecycleBin, ImportAssets, ItemId, MoveAssetsTo, MoveFoldersTo, RecoverItem, RenameItem } from "../backend"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/toasts/err-toast"
import MsgToast from "../widgets/toasts/msg-toast"
import DuplicationList from "../widgets/duplication-list"
import { t } from "../i18n"
import { decodeId, decodeItem } from "../util"
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
        parent: string,
    ) {
        const dup = await ImportAssets({ parent, path: items })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        const folder = await GetFolder({ folder: parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (folder) {
            browsingFolder?.setter({
                ...folder,
                content: folder.content.map(a => { return { id: a, ty: "asset" } }),
                subTy: "folder",
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
    }

    async function handleAssetsMove(
        moved: string[],
        target: string,
    ) {
        await MoveAssetsTo({ assets: moved, folder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedItems?.setter(selectedItems.data?.filter(a => !moved.includes(a.id)))
        if (browsingFolder?.data) {
            browsingFolder.setter({
                ...browsingFolder.data,
                content: browsingFolder.data.content.filter(c => !moved.includes(c.id))
            })
        }
    }

    async function handleFolderDeletion(
        targetIds: string[],
        permanently: boolean,
    ) {
        await DeleteFolders({ folders: targetIds, permanently })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder?.data?.id && targetIds.includes(browsingFolder.data?.id)) {
            browsingFolder.setter(undefined)
            selectedItems?.setter([])
        }
    }

    async function handleFolderCreation(
        newNames: string[],
        parent: string,
    ) {
        await CreateFolders({ folderNames: newNames, parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
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

    async function handleFoldersImport(
        items: string[],
        parent: string,
    ) {
        const dup = await ImportAssets({ parent, path: items })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (dup) {
            dispatchToast(<MsgToast
                title={t("toast.assetDuplication.title")}
                body={<DuplicationList list={dup} />}
            />,
                { intent: "warning" }
            )
        }
    }

    async function handleFoldersMove(
        moved: string[],
        target: string,
    ) {
        await MoveFoldersTo({ srcFolders: moved, dstFolder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedItems?.setter(selectedItems.data?.filter(a => !moved.includes(a.id)))
    }

    // Collections

    async function handleCollectionDeletion(
        targetIds: string[],
        permanently: boolean,
    ) {
        await DeleteFolders({ folders: targetIds, permanently })
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
        await CreateFolders({ folderNames: newNames, parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
    }

    async function handleCollectionsImport(
        items: string[],
        parent: string,
    ) {
        const dup = await ImportAssets({ parent, path: items })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (dup) {
            dispatchToast(<MsgToast
                title={t("toast.assetDuplication.title")}
                body={<DuplicationList list={dup} />}
            />,
                { intent: "warning" }
            )
        }
    }

    async function handleCollectionsMove(
        moved: string[],
        target: string,
    ) {
        await MoveFoldersTo({ srcFolders: moved, dstFolder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedItems?.setter(selectedItems.data?.filter(a => !moved.includes(a.id)))
    }

    async function handleObjectsRecover() {
        if (selectedItems?.data && browsingFolder?.data) {
            const items = selectedItems.data.map(item => {
                switch (item.ty) {
                    case "asset":
                        return { asset: item.id }
                    case "folder":
                        return { folder: item.id }
                    // TODO collection and tag
                }
            }).filter(id => id != undefined)

            await RecoverItem({ items })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            const recycleBin = await GetRecycleBin()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (recycleBin) {
                selectedItems.setter([])
                browsingFolder.setter({
                    ...browsingFolder.data,
                    content: recycleBin.map(obj => {
                        const decoded = decodeItem(obj)
                        return { id: decoded.id, ty: decoded.ty }
                    }),
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
        if (data?.submit == undefined || !browsingFolder || !selectedItems) { return }

        if (data.id.length > 0 && data.op == "recover") {
            handleObjectsRecover()
        }

        const assets = data.id.filter(id => id.ty == "asset").map(id => id.id)
        const folder = data.id.filter(id => id.ty == "folder").map(id => id.id)
        const collections = data.id.filter(id => id.ty == "collection").map(id => id.id)
        const tags = data.id.filter(id => id.ty == "tag").map(id => id.id)

        if (folder.length > 0) {
            switch (data.op) {
                case "rename": handleFolderAlikeRename({ id: folder[0], ty: "folder" }, data.submit[0]); break
                case "deletion": handleFolderDeletion(folder, false); break
                case "deletionPermanent": handleFolderDeletion(folder, true); break
                case "create": handleFolderCreation(data.submit, folder[0]); break
                case "import": handleFoldersImport(data.submit, folder[0]); break
                case "move": handleFoldersMove(folder, data.submit[0]); break
            }
        }

        if (assets.length > 0) {
            switch (data.op) {
                case "rename": handleAssetRename(data.submit[0], assets[0]); break
                case "deletion": handleAssetDeletion(assets, false); break
                case "deletionPermanent": handleAssetDeletion(assets, true); break
                case "create": console.error("Creating an asset is invalid."); break
                case "import": handleAssetsImport(data.submit, assets[0]); break
                case "move": handleAssetsMove(assets, data.submit[0]); break
            }
        }

        if (collections.length > 0) {
            switch (data.op) {
                case "rename": handleFolderAlikeRename({ id: collections[0], ty: "collection" }, data.submit[0]); break
                // case "deletion": handleAssetDeletion(assets, false); break
                // case "deletionPermanent": handleAssetDeletion(assets, true); break
                // case "create": console.error("Creating an asset is invalid."); break
                // case "move": handleAssetsMove(assets, data.submit[0]); break
            }
        }

        if (tags.length > 0) {
            switch (data.op) {
                case "rename": handleFolderAlikeRename({ id: tags[0], ty: "tag" }, data.submit[0]); break
                // case "deletion": handleAssetDeletion(assets, false); break
                // case "deletionPermanent": handleAssetDeletion(assets, true); break
                // case "create": console.error("Creating an asset is invalid."); break
                // case "import": handleAssetsImport(data.submit, assets[0]); break
                // case "move": handleAssetsMove(assets, data.submit[0]); break
            }
        }

        fileManipulation?.setter(undefined)
    }, [fileManipulation])

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
