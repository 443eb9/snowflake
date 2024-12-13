import { useContext, useEffect } from "react"
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext, StateContext, VirtualFolder } from "./context-provider"
import { CreateFolders, DeleteAssets, DeleteFolders, GetFolder, ImportAssets, MoveAssetsTo, MoveFoldersTo, RenameAsset, RenameFolder } from "../backend"
import { useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../main"
import ErrToast from "../widgets/err-toast"
import MsgToast from "../widgets/msg-toast"
import DuplicationList from "../widgets/duplication-list"
import { t } from "../i18n"

export default function FileManipulator() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    async function handleAssetDeletion(browsingFolder: StateContext<VirtualFolder>, selectedAssets: StateContext<string[]>) {
        if (!browsingFolder?.data || !selectedAssets?.data) {
            return
        }

        browsingFolder.setter({
            ...browsingFolder.data,
            content: [...browsingFolder.data.content.filter((id: any) => !selectedAssets.data?.includes(id))]
        })
        await DeleteAssets({ assets: [...selectedAssets?.data?.values() ?? []] })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedAssets.setter([])
    }

    async function handleAssetRename(browsingFolder: StateContext<VirtualFolder>, selectedAssets: StateContext<string[]>, newName: string) {
        if (!browsingFolder?.data || !selectedAssets?.data || selectedAssets.data.length != 1) {
            return
        }
        const target = selectedAssets.data.values().next().value as string
        await RenameAsset({ asset: target, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedAssets.setter([])
        browsingFolder.setter({
            ...browsingFolder.data,
        })
    }

    async function handleFolderDeletion(
        browsingFolder: StateContext<VirtualFolder>,
        selectedAssets: StateContext<string[]>,
        targetIds: string[],
    ) {
        await DeleteFolders({ folders: targetIds })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder.data?.id && targetIds.includes(browsingFolder.data?.id)) {
            browsingFolder.setter(undefined)
            selectedAssets.setter([])
        }
    }

    async function handleFolderCreation(
        newNames: string[],
        parent: string
    ) {
        await CreateFolders({ folderNames: newNames, parent })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
    }

    async function handleFolderRename(
        browsingFolder: StateContext<VirtualFolder>,
        selectedAssets: StateContext<string[]>,
        targetId: string,
        newName: string,
    ) {
        await RenameFolder({ folder: targetId, name: newName })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (targetId == browsingFolder.data?.id) {
            browsingFolder.setter(undefined)
            selectedAssets.setter([])
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
                collection: false,
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
        selectedAssets: StateContext<string[]>,
        moved: string[],
        target: string,
    ) {
        await MoveAssetsTo({ assets: moved, folder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedAssets.setter(selectedAssets.data?.filter(a => !moved.includes(a)))
        if (browsingFolder.data) {
            browsingFolder.setter({
                ...browsingFolder.data,
                content: browsingFolder.data.content.filter(c => !moved.includes(c))
            })
        }
    }

    async function handleFoldersMove(
        selectedAssets: StateContext<string[]>,
        moved: string[],
        target: string,
    ) {
        await MoveFoldersTo({ srcFolders: moved, dstFolder: target })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        selectedAssets.setter(selectedAssets.data?.filter(a => !moved.includes(a)))
    }

    useEffect(() => {
        const data = fileManipulation?.data
        if (data?.submit == undefined || !browsingFolder || !selectedAssets) { return }

        switch (data.id_ty) {
            case "folder":
                switch (data.ty) {
                    case "rename": handleFolderRename(browsingFolder, selectedAssets, data.id[0], data.submit[0]); break
                    case "deletion": handleFolderDeletion(browsingFolder, selectedAssets, data.id); break
                    case "create": handleFolderCreation(data.submit, data.id[0]); break
                    case "import": handleFoldersImport(data.submit, data.id[0]); break
                    case "move": handleFoldersMove(selectedAssets, data.id, data.submit[0]); break
                }
                break
            case "assets":
                switch (data.ty) {
                    case "rename": handleAssetRename(browsingFolder, selectedAssets, data.submit[0]); break
                    case "deletion": handleAssetDeletion(browsingFolder, selectedAssets); break
                    case "create": console.error("Creating an asset is invalid."); break
                    case "import": handleAssetsImport(browsingFolder, data.submit, data.id[0]); break
                    case "move": handleAssetsMove(browsingFolder, selectedAssets, data.id, data.submit[0]); break
                }
                break
            case "collection":
                break
        }

        fileManipulation?.setter(undefined)
    }, [fileManipulation])

    useEffect(() => {
        document.querySelectorAll(".selected-asset")
            .forEach(elem => {
                if (!selectedAssets?.data?.includes(elem.id)) {
                    elem.classList.remove("selected-asset")
                }
            })
    }, [selectedAssets?.data])

    return <></>
}
