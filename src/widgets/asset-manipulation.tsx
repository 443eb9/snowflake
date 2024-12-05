import { Button, Input, makeStyles, Menu, MenuButton, MenuPopover, MenuTrigger, Text } from "@fluentui/react-components"
import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons"
import { useContext, useState } from "react"
import { browsingFolderContext, fileManipulationContext, selectedAssetsContext } from "../context-provider"

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
                submit: "",
            })
        }
    }

    const handleRename = () => {
        if (browsingFolder && fileManipulation && selectedAssets?.data) {
            fileManipulation.setter({
                id: selectedAssets.data,
                ty: "rename",
                is_folder: false,
                submit: newName,
            })
            setPopoverOpen(false)
        }
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
        </div>
    )
}
