import { Button, Input, makeStyles, Menu, MenuButton, MenuPopover, MenuTrigger, Text } from "@fluentui/react-components"
import { Add20Regular, Delete20Regular, Edit20Regular, FolderAdd20Regular, FolderOpen20Regular } from "@fluentui/react-icons"
import { useContext, useState } from "react"
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "../context-provider"
import { open } from "@tauri-apps/plugin-dialog"
import { GetFolder, ImportAssets } from "../backend"

const inputStyleHook = makeStyles({
    root: {
        "width": "150px",
    }
})

export default function AssetManipulation() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const inputStyle = inputStyleHook()
    const [newName, setNewName] = useState("")
    const [popoverOpen, setPopoverOpen] = useState(false)

    const handleDelete = () => {
        if (fileManipulation && selectedAssets?.data) {
            fileManipulation.setter({
                id: selectedAssets.data,
                ty: "deletion",
                is_folder: false,
                submit: [],
            })
        }
    }

    const handleRename = () => {
        if (browsingFolder && fileManipulation && selectedAssets?.data) {
            fileManipulation.setter({
                id: selectedAssets.data,
                ty: "rename",
                is_folder: false,
                submit: [newName],
            })
            setPopoverOpen(false)
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
                is_folder: folder,
                submit: items,
            })
        }
    }

    function handleCreate() {
        const parent = browsingFolder?.data?.id
        if (!parent) { return }

        fileManipulation?.setter({
            id: [parent],
            is_folder: true,
            ty: "create",
            submit: ["New Folder"],
        })
    }

    const selectedCount = selectedAssets?.data?.length ?? 0

    return (
        <div className="flex gap-1">
            <Button icon={<Delete20Regular />} disabled={selectedCount == 0} onClick={handleDelete} />
            <Menu inline open={popoverOpen} onOpenChange={(_, d) => setPopoverOpen(d.open)}>
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
            {
                !browsingFolder?.data?.collection &&
                <>
                    <Button icon={<Add20Regular />} onClick={() => handleAdd(false)} />
                    <Button icon={<FolderOpen20Regular />} onClick={() => handleAdd(true)} />
                    <Button icon={<FolderAdd20Regular />} onClick={() => handleCreate()} />
                </>
            }
        </div>
    )
}
