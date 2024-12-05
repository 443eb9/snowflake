import { Menu as CtxMenu, Item as CtxItem, ItemParams, Submenu } from "react-contexify";
import "../context.css"
import { Button, CompoundButton, Input, makeStyles, Text } from "@fluentui/react-components";
import { ArrowForward20Regular, Delete20Regular, Edit20Regular, FolderArrowRight20Regular } from "@fluentui/react-icons";
import { useContext, useEffect, useState } from "react";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedAssetsContext } from "../context-provider";
import { Folder, GetFolderTree } from "../backend";

export const CtxMenuId = "context-menu"

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

const inputStyleHook = makeStyles({
    root: {
        "width": "100%",
        "padding": "4px",
    }
})

export default function ContextMenu() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedAssets = useContext(selectedAssetsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const [allFolders, setAllFolders] = useState<Folder[] | undefined>()
    const [filter, setFilter] = useState("")

    const buttonStyle = buttonStyleHook()
    const inputStyle = inputStyleHook()

    useEffect(() => {
        async function fetch() {
            const folders = await GetFolderTree()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })

            if (folders) {
                setAllFolders(Array.from(folders.values()))
            }
        }

        fetch()
        setFilter("")
    }, [contextMenuProp])

    const handleDelete = (ev: ItemParams) => {
        const folderId = (ev.triggerEvent.target as HTMLElement).id
        if (folderId.length > 0) {
            fileManipulation?.setter({
                id: [folderId],
                id_ty: "folder",
                ty: "deletion",
                submit: [],
            })
        } else if (selectedAssets?.data && browsingFolder && selectedAssets && fileManipulation) {
            fileManipulation.setter({
                id: selectedAssets.data,
                id_ty: "assets",
                ty: "deletion",
                submit: [],
            })
        }
    }

    const handleRename = () => {
        if (fileManipulation?.data?.id_ty == "folder") {
            fileManipulation.setter({
                ...fileManipulation.data,
                ty: "rename",
            })
        }

        if (selectedAssets?.data?.length == 1 && browsingFolder && selectedAssets && fileManipulation) {
            fileManipulation.setter({
                id: selectedAssets.data,
                id_ty: "assets",
                ty: "rename",
                submit: undefined,
            })
        }
    }

    const handleMove = (dst: Folder) => {
        const target = contextMenuProp?.data?.target
        if (!target) { return }

        switch (target) {
            case "folder":
                if (contextMenuProp.data?.id) {
                    fileManipulation?.setter({
                        id: [contextMenuProp.data?.id],
                        id_ty: "folder",
                        ty: "move",
                        submit: [dst.id],
                    })
                }
                break
            case "assets":
                if (selectedAssets?.data) {
                    fileManipulation?.setter({
                        id: selectedAssets?.data,
                        id_ty: "assets",
                        ty: "move",
                        submit: [dst.id],
                    })
                }
                break
        }
    }

    const multipleSelected = contextMenuProp?.data?.target == "assets" &&
        selectedAssets?.data?.length != undefined && selectedAssets.data.length > 1

    const standardizeFilter = filter.toLowerCase()

    return (
        <CtxMenu id={CtxMenuId} theme="dark">
            <CtxItem onClick={handleDelete}>
                <Button
                    className={buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                >
                    <Text>Delete</Text>
                </Button>
            </CtxItem>
            <CtxItem onClick={handleRename} disabled={multipleSelected}>
                <Button
                    className={buttonStyle.root}
                    icon={<Edit20Regular />}
                    appearance="subtle"
                >
                    <Text>Rename</Text>
                </Button>
            </CtxItem>
            <Submenu
                label={
                    <Button
                        className={buttonStyle.root}
                        icon={<ArrowForward20Regular />}
                        appearance="subtle"
                    >
                        <Text>Move To</Text>
                    </Button>
                }
            >
                <Input
                    className={inputStyle.root}
                    autoFocus
                    appearance="underline"
                    onChange={ev => setFilter(ev.target.value)}
                />
                <div className="max-h-[300px] overflow-auto mt-1">
                    {
                        allFolders
                            ?.filter(folder => folder.name.toLowerCase().includes(standardizeFilter))
                            .map((folder, index) =>
                                <CtxItem key={index} onClick={() => handleMove(folder)}>
                                    <CompoundButton
                                        className={buttonStyle.root}
                                        icon={<FolderArrowRight20Regular />}
                                        secondaryContent={folder.id}
                                        appearance="subtle"
                                        size="small"
                                    >
                                        <Text>{folder.name}</Text>
                                    </CompoundButton>
                                </CtxItem>
                            )
                    }
                </div>
            </Submenu>
        </CtxMenu>
    )
}
