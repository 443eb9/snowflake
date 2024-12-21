import { Button, Input, makeStyles, Menu, MenuButton, MenuPopover, MenuTrigger, Text } from "@fluentui/react-components"
import { Add20Regular, ArrowCounterclockwise20Regular, ArrowDownload20Regular, Checkmark20Regular, Delete20Regular, Edit20Regular, FolderOpen20Regular } from "@fluentui/react-icons"
import { useContext, useState } from "react"
import { browsingFolderContext, fileManipulationContext, overlaysContext, selectedItemsContext } from "../helpers/context-provider"
import { open } from "@tauri-apps/plugin-dialog"
import { t } from "../i18n"

const renameInputStyleHook = makeStyles({
    root: {
        "width": "150px",
    }
})

const confirmTextStyleHook = makeStyles({
    root: {
        "color": "var(--colorPaletteRedForeground1)"
    }
})

export default function AssetManipulation() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const overlays = useContext(overlaysContext)

    const inputStyle = renameInputStyleHook()
    const confirmTextStyle = confirmTextStyleHook()

    const [newName, setNewName] = useState("")
    const [renamePopoverOpen, setRenamePopoverOpen] = useState(false)
    const [confirmPopoverOpen, setConfirmPopoverOpen] = useState(false)

    const handleDelete = () => {
        if (selectedItems?.data) {
            fileManipulation?.setter({
                id: selectedItems.data,
                op: "deletion",
                submit: [],
            })
        }
    }

    const handleRename = () => {
        if (browsingFolder && selectedItems?.data) {
            fileManipulation?.setter({
                id: selectedItems.data,
                op: "rename",
                submit: [newName],
            })
            setRenamePopoverOpen(false)
        }
    }

    async function handleImport(folder: boolean) {
        const items = await open({
            title: t("asset-mani.importDialogTitle"),
            multiple: true,
            directory: folder,
        })

        if (items) {
            fileManipulation?.setter({
                id: [{ id: browsingFolder?.data?.id ?? "", ty: "tag" }],
                op: "import",
                submit: items,
            })
            selectedItems?.setter([])
        }
    }

    function handleRecover() {
        if (selectedItems?.data) {
            fileManipulation?.setter({
                id: selectedItems.data,
                op: "recover",
                submit: [],
            })
        }
    }

    async function handlePermanentlyDelete() {
        if (selectedItems?.data) {
            fileManipulation?.setter({
                id: selectedItems.data,
                op: "deletionPermanent",
                submit: [],
            })

            if (browsingFolder?.data) {
                browsingFolder?.setter({
                    ...browsingFolder.data,
                    content: browsingFolder.data.content.filter(id => selectedItems.data?.find(selected => selected.id == id.id) == undefined)
                })
            }
        }
    }

    const selectedCount = selectedItems?.data?.length ?? 0

    if (!browsingFolder?.data) {
        return <></>
    }

    function getButtons() {
        switch (browsingFolder?.data?.subTy) {
            case "all":
            case "uncategoriezed":
            case "tag":
                return (
                    <>
                        <Button
                            icon={<Delete20Regular />}
                            disabled={selectedCount == 0}
                            onClick={handleDelete}
                            appearance="outline"
                        />
                        <Menu open={renamePopoverOpen} onOpenChange={(_, d) => setRenamePopoverOpen(d.open)}>
                            <MenuTrigger>
                                <MenuButton
                                    icon={<Edit20Regular />}
                                    disabled={selectedCount != 1}
                                    appearance="outline"
                                />
                            </MenuTrigger>
                            <MenuPopover>
                                <div className="flex flex-grow gap-2 items-center p-1">
                                    <Text>{t("asset-mani.rename")}</Text>
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
                    </>
                )
            case "recycleBin":
                return (
                    <>
                        <Button icon={<ArrowCounterclockwise20Regular />} disabled={selectedCount == 0} onClick={handleRecover} />
                        <Menu open={confirmPopoverOpen} onOpenChange={(_, d) => setConfirmPopoverOpen(d.open)}>
                            <MenuTrigger>
                                <MenuButton
                                    icon={<Delete20Regular />}
                                    disabled={selectedCount == 0}
                                    appearance="outline"
                                />
                            </MenuTrigger>
                            <MenuPopover>
                                <div className="flex flex-grow gap-2 items-center p-1">
                                    <Text className={confirmTextStyle.root}>{t("asset-mani.delPerm.confirm")}</Text>
                                    <Button
                                        className={confirmTextStyle.root}
                                        icon={<Checkmark20Regular />}
                                        onClick={() => {
                                            setConfirmPopoverOpen(false)
                                            handlePermanentlyDelete()
                                        }}
                                    />
                                </div>
                            </MenuPopover>
                        </Menu>
                    </>
                )
        }
    }

    return (
        <div className="flex gap-1 justify-between">
            <div className="flex gap-1">
                {getButtons()}
            </div>
            <div className="flex gap-1">
                {
                    browsingFolder?.data?.subTy != "recycleBin" &&
                    <>
                        <Button icon={<Add20Regular />} onClick={() => handleImport(false)} appearance="outline" />
                        <Button icon={<FolderOpen20Regular />} onClick={() => handleImport(true)} appearance="outline" />
                        <Button icon={<ArrowDownload20Regular />} onClick={() => overlays?.setter({ ty: "assetDownload" })} appearance="outline" />
                    </>
                }
            </div>
        </div>
    )
}
