import { Button, Input, makeStyles, Menu, MenuButton, MenuPopover, MenuTrigger, Text } from "@fluentui/react-components"
import { Add20Regular, ArrowDownload20Regular, Delete20Regular, Edit20Regular, FolderAdd20Regular, FolderOpen20Regular } from "@fluentui/react-icons"
import { useContext, useState } from "react"
import { browsingFolderContext, fileManipulationContext, overlaysContext, selectedAssetsContext } from "../context-provider"
import { open } from "@tauri-apps/plugin-dialog"

const renameInputStyleHook = makeStyles({
    root: {
        "width": "150px",
    }
})

export default function AssetManipulation() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const overlays = useContext(overlaysContext)

    const inputStyle = renameInputStyleHook()

    const [newName, setNewName] = useState("")
    const [renamePopoverOpen, setRenamePopoverOpen] = useState(false)

    const handleDelete = () => {
        if (fileManipulation && selectedAssets?.data) {
            fileManipulation.setter({
                id: selectedAssets.data,
                ty: "deletion",
                id_ty: "assets",
                submit: [],
            })
        }
    }

    const handleRename = () => {
        if (browsingFolder && fileManipulation && selectedAssets?.data) {
            fileManipulation.setter({
                id: selectedAssets.data,
                ty: "rename",
                id_ty: "assets",
                submit: [newName],
            })
            setRenamePopoverOpen(false)
        }
    }

    async function handleAdd(folder: boolean) {
        const parent = browsingFolder?.data?.id
        if (!parent) { return }

        const items = await open({
            title: "Select assets you want to import",
            multiple: true,
            directory: folder,
        })

        if (items) {
            fileManipulation?.setter({
                id: [parent],
                ty: "import",
                id_ty: folder ? "folder" : "assets",
                submit: items,
            })
        }
    }

    function handleCreate() {
        const parent = browsingFolder?.data?.id
        if (!parent) { return }

        fileManipulation?.setter({
            id: [parent],
            id_ty: "folder",
            ty: "create",
            submit: ["New Folder"],
        })
    }

    const selectedCount = selectedAssets?.data?.length ?? 0

    if (!browsingFolder?.data) {
        return <></>
    }

    return (
        <div className="flex gap-1 justify-between">
            <div className="flex gap-1">
                <Button icon={<Delete20Regular />} disabled={selectedCount == 0} onClick={handleDelete} />
                <Menu open={renamePopoverOpen} onOpenChange={(_, d) => setRenamePopoverOpen(d.open)}>
                    <MenuTrigger>
                        <MenuButton
                            icon={<Edit20Regular />}
                            disabled={selectedCount != 1}
                        />
                    </MenuTrigger>
                    <MenuPopover>
                        <div className="flex flex-grow gap-2 items-center p-1">
                            <Text>New name</Text>
                            <Input
                                className={inputStyle.root}
                                onChange={ev => setNewName(ev.target.value)}
                                onKeyDown={ev => {
                                    if (ev.key == "Enter") {
                                        handleRename()
                                    }
                                }}
                            />
                        </div>
                    </MenuPopover>
                </Menu>
            </div>
            <div className="flex gap-1">
                {
                    !browsingFolder?.data?.collection &&
                    <>
                        <Button icon={<Add20Regular />} onClick={() => handleAdd(false)} />
                        <Button icon={<FolderOpen20Regular />} onClick={() => handleAdd(true)} />
                        <Button icon={<FolderAdd20Regular />} onClick={() => handleCreate()} />
                        <Button icon={<ArrowDownload20Regular />} onClick={() => overlays?.setter({ ty: "assetDownload" })} />
                    </>
                }
            </div>
        </div>
    )
}
