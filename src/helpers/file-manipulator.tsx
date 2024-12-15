import { useContext, useEffect } from "react"
import { browsingFolderContext, fileManipulationContext, selectedObjectsContext, StateContext, VirtualFolder } from "./context-provider"
import { CreateFolders, DeleteAssets, DeleteFolders, GetFolder, ImportAssets, ItemId, MoveAssetsTo, MoveFoldersTo, RenameAsset, RenameFolder } from "../backend"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/err-toast"
import MsgToast from "../widgets/msg-toast"
import DuplicationList from "../widgets/duplication-list"
import { t } from "../i18n"
import { decodeId } from "../util"
import { SelectedClassTag } from "../widgets/items-grid"

export default function FileManipulator() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedObjects = useContext(selectedObjectsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    async function handleAssetDeletion(
        browsingFolder: StateContext<VirtualFolder>,
        selectedObjects: StateContext<ItemId[]>,
        assets: string[],
        permanently: boolean,
    ) {
        if (!browsingFolder?.data || !selectedObjects?.data) {
            return
        }

        browsingFolder.setter({
            ...browsingFolder.data,
            content: [...browsingFolder.data.content.filter(id => selectedObjects.data?.find(selected => selected.id == id.id) == undefined)]
        })
        await DeleteAssets({ assets, permanently })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedObjects.setter([])
    }

    async function handleAssetRename(
        browsingFolder: StateContext<VirtualFolder>,
        selectedObjects: StateContext<ItemId[]>,
        newName: string,
        asset: string,
    ) {
        if (!browsingFolder?.data || !selectedObjects?.data || selectedObjects.data.length != 1) {
            return
        }
        await RenameAsset({ asset, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedObjects.setter([])
        browsingFolder.setter({
            ...browsingFolder.data,
        })
    }

    async function handleFolderDeletion(
        browsingFolder: StateContext<VirtualFolder>,
        selectedObjects: StateContext<ItemId[]>,
        targetIds: string[],
        permanently: boolean,
    ) {
        await DeleteFolders({ folders: targetIds, permanently })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder.data?.id && targetIds.includes(browsingFolder.data?.id)) {
            browsingFolder.setter(undefined)
            selectedObjects.setter([])
        }
    }

    async function handleFolderCreation(
        newNames: string[],
        parent: string,
    ) {
        await CreateFolders({ folderNames: newNames, parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
    }

    async function handleFolderRename(
        browsingFolder: StateContext<VirtualFolder>,
        selectedObjects: StateContext<ItemId[]>,
        targetId: string,
        newName: string,
    ) {
        await RenameFolder({ folder: targetId, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (targetId == browsingFolder.data?.id) {
            browsingFolder.setter(undefined)
            selectedObjects.setter([])
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

    async function handleAssetsImport(
        browsingFolder: StateContext<VirtualFolder>,
        items: string[],
        parent: string,
    ) {
        const dup = await ImportAssets({ parent, path: items })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        const folder = await GetFolder({ folder: parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (folder) {
            browsingFolder.setter({
                ...folder,
                content: folder.content.map(a => { return { id: a, ty: "asset" } }),
                specialTy: "folder",
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
        browsingFolder: StateContext<VirtualFolder>,
        selectedObjects: StateContext<ItemId[]>,
        moved: string[],
        target: string,
    ) {
        await MoveAssetsTo({ assets: moved, folder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedObjects.setter(selectedObjects.data?.filter(a => !moved.includes(a.id)))
        if (browsingFolder.data) {
            browsingFolder.setter({
                ...browsingFolder.data,
                content: browsingFolder.data.content.filter(c => !moved.includes(c.id))
            })
        }
    }

    async function handleFoldersMove(
        selectedObjects: StateContext<ItemId[]>,
        moved: string[],
        target: string,
    ) {
        await MoveFoldersTo({ srcFolders: moved, dstFolder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedObjects.setter(selectedObjects.data?.filter(a => !moved.includes(a.id)))
    }

    useEffect(() => {
        const data = fileManipulation?.data
        if (data?.submit == undefined || !browsingFolder || !selectedObjects) { return }

        const assets = data.id.filter(id => id.ty == "asset").map(id => id.id)
        const folder = data.id.filter(id => id.ty == "folder").map(id => id.id)

        if (folder.length > 0) {
            switch (data.op) {
                case "rename": handleFolderRename(browsingFolder, selectedObjects, folder[0], data.submit[0]); break
                case "deletion": handleFolderDeletion(browsingFolder, selectedObjects, folder, false); break
                case "deletionPermanent": handleFolderDeletion(browsingFolder, selectedObjects, folder, true); break
                case "create": handleFolderCreation(data.submit, folder[0]); break
                case "import": handleFoldersImport(data.submit, folder[0]); break
                case "move": handleFoldersMove(selectedObjects, folder, data.submit[0]); break
            }
        }

        if (assets.length > 0) {
            switch (data.op) {
                case "rename": handleAssetRename(browsingFolder, selectedObjects, data.submit[0], assets[0]); break
                case "deletion": handleAssetDeletion(browsingFolder, selectedObjects, assets, false); break
                case "deletionPermanent": handleAssetDeletion(browsingFolder, selectedObjects, assets, true); break
                case "create": console.error("Creating an asset is invalid."); break
                case "import": handleAssetsImport(browsingFolder, data.submit, assets[0]); break
                case "move": handleAssetsMove(browsingFolder, selectedObjects, assets, data.submit[0]); break
            }
        }

        fileManipulation?.setter(undefined)
    }, [fileManipulation])

    useEffect(() => {
        document.querySelectorAll(`.${SelectedClassTag}`)
            .forEach(elem => {
                if (selectedObjects?.data?.find(selected => selected.id == decodeId(elem.id).id) == undefined) {
                    elem.classList.remove(SelectedClassTag)
                }
            })
    }, [selectedObjects?.data])

    return <></>
}
