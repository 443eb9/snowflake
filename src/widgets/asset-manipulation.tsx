import { Button, Input, makeStyles, Menu, MenuButton, MenuPopover, MenuTrigger, Text } from "@fluentui/react-components"
import { Delete20Regular, Edit20Regular } from "@fluentui/react-icons"
import { useContext, useState } from "react"
import { browsingFolderContext, selectedAssetsContext } from "../context-provider"
import { DeleteAssets, RenameAsset } from "../backend"
import { Checkmark20Regular } from "@fluentui/react-icons/fonts"

const inputStyleHook = makeStyles({
    root: {
        "width": "150px",
    }
})

export default function AssetManipulation() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)

    const inputStyle = inputStyleHook()
    const [newName, setNewName] = useState("")
    const [popoverOpen, setPopoverOpen] = useState(false)

    const handleDelete = async () => {
        if (!browsingFolder?.data || !selectedAssets?.data) {
            return
        }

        browsingFolder.setter({
            ...browsingFolder.data,
            content: [...browsingFolder.data.content.filter(id => !selectedAssets.data?.includes(id))]
        })
        await DeleteAssets({ assets: [...selectedAssets?.data?.values() ?? []] })
            .catch(err => {
                //TODO error handling
                console.error(err)
            })
    }

    const handleRename = async () => {
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
        setPopoverOpen(false)
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
