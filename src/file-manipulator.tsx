import { useContext, useEffect } from "react"
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext, StateContext, VirtualFolder } from "./context-provider"
import { CreateFolders, DeleteAssets, DeleteFolders, ImportAssets, RenameAsset, RenameFolder } from "./backend"

export default function FileManipulator() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

    useEffect(() => {
        if (fileManipulation?.data?.submit == undefined || !browsingFolder || !selectedAssets) { return }
        console.log(fileManipulation)

        if (fileManipulation.data.is_folder) {
            switch (fileManipulation.data.ty) {
                case "rename":
                    handleFolderRename(browsingFolder, selectedAssets, fileManipulation.data.id[0], fileManipulation.data.submit[0])
                    break
                case "deletion":
                    handleFolderDeletion(browsingFolder, selectedAssets, fileManipulation.data.id)
                    break
                case "create":
                    handleFolderCreation(fileManipulation.data.submit, fileManipulation.data.id[0])
                    break
                case "import":
                    handleAssetsImport(fileManipulation.data.submit, fileManipulation.data.id[0])
                    break
            }
        } else {
            switch (fileManipulation.data.ty) {
                case "rename":
                    handleAssetRename(browsingFolder, selectedAssets, fileManipulation.data.submit[0])
                    break
                case "deletion":
                    handleAssetDeletion(browsingFolder, selectedAssets)
                    break
                case "create":
                    console.error("Creating an asset is invalid.")
                    break
                case "import":
                    console.error("Importing an asset is invalid. Set is_folder to true.")
                    break
            }
        }

        fileManipulation.setter(undefined)
    }, [fileManipulation])

    return <></>
}

export async function handleAssetDeletion(browsingFolder: StateContext<VirtualFolder>, selectedAssets: StateContext<string[]>) {
    if (!browsingFolder?.data || !selectedAssets?.data) {
        return
    }

    browsingFolder.setter({
        ...browsingFolder.data,
        content: [...browsingFolder.data.content.filter((id: any) => !selectedAssets.data?.includes(id))]
    })
    await DeleteAssets({ assets: [...selectedAssets?.data?.values() ?? []] })
        .catch(err => {
            //TODO error handling
            console.error(err)
        })

    selectedAssets.setter([])
    document.querySelectorAll("selected-asset")
        .forEach(elem => elem.classList.remove("selected-asset"))
}

export async function handleAssetRename(browsingFolder: StateContext<VirtualFolder>, selectedAssets: StateContext<string[]>, newName: string) {
    if (!browsingFolder?.data || !selectedAssets?.data || selectedAssets.data.length != 1) {
        return
    }
    const target = selectedAssets.data.values().next().value as string
    await RenameAsset({ asset: target, nameNoExt: newName })
        .catch(err => {
            // TODO error handling
            console.error(err)
        })

    browsingFolder.setter(browsingFolder.data)

    selectedAssets.setter([])
    document.querySelectorAll("selected-asset")
        .forEach(elem => elem.classList.remove("selected-asset"))

    browsingFolder.setter({
        ...browsingFolder.data
    })
}

export async function handleFolderDeletion(
    browsingFolder: StateContext<VirtualFolder>,
    selectedAssets: StateContext<string[]>,
    targetIds: string[],
) {
    await DeleteFolders({ folders: targetIds })
        .catch(err => {
            // TODO error handling
            console.error(err)
        })

    if (browsingFolder.data?.id && targetIds.includes(browsingFolder.data?.id)) {
        browsingFolder.setter(undefined)
        selectedAssets.setter([])
    }
}

export async function handleFolderCreation(
    newNames: string[],
    parent: string
) {
    await CreateFolders({ folderNames: newNames, parent })
        .catch(err => {
            // TODO error handling
            console.error(err)
        })
}

export async function handleFolderRename(
    browsingFolder: StateContext<VirtualFolder>,
    selectedAssets: StateContext<string[]>,
    targetId: string,
    newName: string,
) {
    await RenameFolder({ folder: targetId, name: newName })
        .catch(err => {
            // TODO error handling
            console.error(err)
        })

    if (targetId == browsingFolder.data?.id) {
        browsingFolder.setter(undefined)
        selectedAssets.setter([])
    }
}

export async function handleAssetsImport(
    items: string[],
    parent: string,
) {
    await ImportAssets({ parent, path: items })
        .catch(err => {
            // TODO error handling
            console.error(err)
        })
}
