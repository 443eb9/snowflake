import { useContext, useEffect } from "react"
import { browsingFolderContext, fileManipulationContext, selectedObjectsContext } from "./context-provider"
import { CreateFolders, DeleteAssets, DeleteFolders, GetFolder, GetRecycleBin, ImportAssets, MoveAssetsTo, MoveFoldersTo, RecoverObjects, RenameAsset, RenameFolder } from "../backend"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/err-toast"
import MsgToast from "../widgets/msg-toast"
import DuplicationList from "../widgets/duplication-list"
import { t } from "../i18n"
import { decodeId, decodeItemObject } from "../util"
import { SelectedClassTag } from "../widgets/items-grid"

export default function FileManipulator() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedObjects = useContext(selectedObjectsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    async function handleAssetDeletion(
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
        targetIds: string[],
        permanently: boolean,
    ) {
        await DeleteFolders({ folders: targetIds, permanently })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder?.data?.id && targetIds.includes(browsingFolder.data?.id)) {
            browsingFolder.setter(undefined)
            selectedObjects?.setter([])
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
        targetId: string,
        newName: string,
    ) {
        await RenameFolder({ folder: targetId, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (targetId == browsingFolder?.data?.id) {
            browsingFolder.setter(undefined)
            selectedObjects?.setter([])
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

        selectedObjects?.setter(selectedObjects.data?.filter(a => !moved.includes(a.id)))
        if (browsingFolder?.data) {
            browsingFolder.setter({
                ...browsingFolder.data,
                content: browsingFolder.data.content.filter(c => !moved.includes(c.id))
            })
        }
    }

    async function handleFoldersMove(
        moved: string[],
        target: string,
    ) {
        await MoveFoldersTo({ srcFolders: moved, dstFolder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedObjects?.setter(selectedObjects.data?.filter(a => !moved.includes(a.id)))
    }

    async function handleObjectsRecover() {
        if (selectedObjects?.data && browsingFolder?.data) {
            await RecoverObjects({ objects: selectedObjects.data.map(item => item.id) })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            const recycleBin = await GetRecycleBin()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (recycleBin) {
                selectedObjects.setter([])
                browsingFolder.setter({
                    ...browsingFolder.data,
                    content: recycleBin.map(obj => {
                        const decoded = decodeItemObject(obj)
                        return { id: decoded.item.id, ty: decoded.ty }
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
        if (data?.submit == undefined || !browsingFolder || !selectedObjects) { return }

        if (data.id.length > 0 && data.op == "recover") {
            handleObjectsRecover()
        }

        const assets = data.id.filter(id => id.ty == "asset").map(id => id.id)
        const folder = data.id.filter(id => id.ty == "folder").map(id => id.id)

        if (folder.length > 0) {
            switch (data.op) {
                case "rename": handleFolderRename(folder[0], data.submit[0]); break
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
