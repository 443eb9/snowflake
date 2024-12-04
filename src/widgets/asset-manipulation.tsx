import { Button, Input, makeStyles, Menu, MenuButton, MenuPopover, MenuTrigger, Text } from "@fluentui/react-components"
import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons"
import { useContext, useEffect, useState } from "react"
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext, StateContext, VirtualFolder } from "../context-provider"
import { DeleteAssets, RenameAsset } from "../backend"
import { Checkmark20Regular } from "@fluentui/react-icons/fonts"

const inputStyleHook = makeStyles({
    root: {
        "width": "150px",
    }
})

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

export default function AssetManipulation() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const inputStyle = inputStyleHook()
    const [newName, setNewName] = useState("")
    const [popoverOpen, setPopoverOpen] = useState(false)

    useEffect(() => {
        if (!fileManipulation?.data || !fileManipulation.data.submit || !browsingFolder || !selectedAssets) { return }

        switch (fileManipulation.data.ty) {
            case "rename":
                handleAssetRename(browsingFolder, selectedAssets, fileManipulation.data.submit)
        }

        fileManipulation.setter(undefined)
    }, [fileManipulation])

    const handleDelete = async () => {
        if (browsingFolder && selectedAssets) {
            handleAssetDeletion(browsingFolder, selectedAssets)
        }
    }

    const handleRename = async () => {
        if (browsingFolder && selectedAssets) {
            handleAssetRename(browsingFolder, selectedAssets, newName)
            setPopoverOpen(false)
        }
    }

    const selectedCount = selectedAssets?.data?.length ?? 0

    return (
        <div className="flex gap-1">
            <Button icon={<Delete20Regular />} disabled={selectedCount == 0} onClick={handleDelete} />
            <Menu inline open={popoverOpen} onOpenChange={(_, d) => setPopoverOpen(d.open)}>
                <MenuTrigger>
                    <MenuButton icon={<Edit20Regular />} disabled={selectedCount != 1} />
                </MenuTrigger>
                <MenuPopover>
                    <div className="flex flex-grow gap-2 items-center p-1">
                        <Text>New name</Text>
                        <Input className={inputStyle.root} onChange={ev => setNewName(ev.target.value)} />
                        <Button icon={<Checkmark20Regular />} onClick={handleRename} />
                    </div>
                </MenuPopover>
            </Menu>
        </div>
    )
}
