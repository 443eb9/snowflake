import { Menu as CtxMenu, Item as CtxItem, ItemParams, Submenu } from "react-contexify";
import { Button, CompoundButton, makeStyles, Text, useToastController } from "@fluentui/react-components";
import { ArrowForward20Regular, Delete20Regular, DrawImage20Regular, Edit20Regular, FolderArrowRight20Regular, Open20Regular, Tag20Regular, TagDismiss20Regular, TagMultiple20Regular } from "@fluentui/react-icons";
import { useContext, useEffect, useState } from "react";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider";
import { DeltaTagsOf, Folder, GetAllTags, GetFolderTree, OpenWithDefaultApp, QuickRef, Tag } from "../../backend";
import FilterableSearch from "../../components/filterable-search";
import { t } from "../../i18n";
import ErrToast from "../toasts/err-toast";
import { GlobalToasterId } from "../../main";

export const CtxMenuId = "contextMenu"

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

export default function ContextMenu() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const [allFolders, setAllFolders] = useState<Folder[] | undefined>()
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [focused, setFocused] = useState(-1)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const buttonStyle = buttonStyleHook()

    useEffect(() => {
        async function fetch() {
            const folders = await GetFolderTree()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (folders) {
                setAllFolders(Array.from(folders.values()))
            }

            const tags = await GetAllTags()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (tags) {
                setAllTags(tags)
            }
        }

        fetch()
    }, [contextMenuProp?.data])

    const handleDelete = (ev: ItemParams) => {
        const folderId = (ev.triggerEvent.target as HTMLElement).id
        if (folderId.length > 0) {
            fileManipulation?.setter({
                id: [{ id: folderId, ty: "folder" }],
                op: "deletion",
                submit: [],
            })
        } else if (selectedItems?.data && browsingFolder && selectedItems && fileManipulation) {
            fileManipulation.setter({
                id: selectedItems.data,
                op: "deletion",
                submit: [],
            })
        }
    }

    const handleRename = () => {
        if (fileManipulation?.data?.id[0].ty == "folder") {
            fileManipulation.setter({
                ...fileManipulation.data,
                op: "rename",
            })
        }

        if (selectedItems?.data?.length == 1 && browsingFolder && selectedItems && fileManipulation) {
            fileManipulation.setter({
                id: selectedItems.data,
                op: "rename",
                submit: undefined,
            })
        }
    }

    const handleMove = (dst: Folder) => {
        const target = contextMenuProp?.data?.target
        if (!target) { return }

        switch (target) {
            case "folder":
                if (contextMenuProp.data?.extra) {
                    fileManipulation?.setter({
                        id: [{ id: contextMenuProp.data?.extra, ty: "folder" }],
                        op: "move",
                        submit: [dst.id],
                    })
                }
                break
            case "assets":
                if (selectedItems?.data) {
                    fileManipulation?.setter({
                        id: selectedItems?.data,
                        op: "move",
                        submit: [dst.id],
                    })
                }
                break
        }
    }

    const handleTagDelta = async (tag: Tag, add: boolean) => {
        const assets = selectedItems?.data
        if (assets) {
            await DeltaTagsOf({ assets: assets.map(a => a.id), tags: [tag.id], mode: add ? "Add" : "Remove" })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        }
    }

    const handleQuickRef = async () => {
        const target = contextMenuProp?.data?.target
        if (!target) { return }

        switch (target) {
            case "folder":
                if (contextMenuProp.data?.extra) {
                    await QuickRef({ ty: { folder: contextMenuProp.data?.extra } })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
            case "assets":
                if (selectedItems?.data) {
                    await QuickRef({ ty: { asset: selectedItems.data.map(a => a.id) } })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
            case "collection":
                if (contextMenuProp.data?.extra) {
                    await QuickRef({ ty: { tag: contextMenuProp.data.extra } })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
        }
    }

    const handleOpen = async () => {
        const target = contextMenuProp?.data?.target
        if (target != "assets") { return }

        if (selectedItems?.data && selectedItems.data.length == 1) {
            await OpenWithDefaultApp({ asset: selectedItems.data[0].id })
        }
    }

    const multipleSelected = contextMenuProp?.data?.target == "assets" &&
        selectedItems?.data?.length != undefined && selectedItems.data.length > 1

    if (!allFolders || !allTags) {
        return <></>
    }

    return (
        <CtxMenu id={CtxMenuId} theme="dark">
            <CtxItem onClick={handleDelete}>
                <Button
                    className={buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                    disabled={contextMenuProp?.data?.target == "collection"}
                >
                    <Text>{t("ctxMenu.del")}</Text>
                </Button>
            </CtxItem>
            <CtxItem onClick={handleRename} disabled={multipleSelected}>
                <Button
                    className={buttonStyle.root}
                    icon={<Edit20Regular />}
                    appearance="subtle"
                    disabled={contextMenuProp?.data?.target == "collection"}
                >
                    <Text>{t("ctxMenu.rename")}</Text>
                </Button>
            </CtxItem>
            <Submenu
                label={
                    <Button
                        className={buttonStyle.root}
                        icon={<ArrowForward20Regular />}
                        appearance="subtle"
                        onClick={() => setFocused(0)}
                        disabled={contextMenuProp?.data?.target == "collection"}
                    >
                        <Text>{t("ctxMenu.moveTo")}</Text>
                    </Button>
                }
            >
                <FilterableSearch
                    range={allFolders}
                    searchKey={folder => folder.name}
                    component={folder =>
                        <CompoundButton
                            className={buttonStyle.root}
                            icon={<FolderArrowRight20Regular />}
                            secondaryContent={folder.id}
                            appearance="subtle"
                            size="small"
                        >
                            <Text>{folder.name}</Text>
                        </CompoundButton>
                    }
                    noMatch={
                        <CompoundButton appearance="transparent" size="small">
                            <Text>{t("ctxMenu.noFolderFallback")}</Text>
                        </CompoundButton>
                    }
                    itemProps={folder => {
                        return { onClick: () => handleMove(folder) }
                    }}
                    focused={() => focused == 0}
                />
            </Submenu>
            <Submenu
                label={
                    <Button
                        className={buttonStyle.root}
                        icon={<Tag20Regular />}
                        appearance="subtle"
                        onClick={() => setFocused(1)}
                    >
                        <Text>{t("ctxMenu.addTag")}</Text>
                    </Button>
                }
                disabled={contextMenuProp?.data?.target != "assets"}
            >
                {
                    contextMenuProp?.data?.target != "folder" &&
                    <FilterableSearch
                        range={allTags}
                        searchKey={tag => tag.name}
                        component={tag =>
                            <CompoundButton
                                className={buttonStyle.root}
                                icon={<TagMultiple20Regular />}
                                secondaryContent={tag.id}
                                appearance="subtle"
                                size="small"
                            >
                                <Text style={{ color: `#${tag.color}` }}>{tag.name}</Text>
                            </CompoundButton>
                        }
                        noMatch={
                            <CompoundButton appearance="transparent" size="small">
                                <Text>{t("ctxMenu.noTagFallback")}</Text>
                            </CompoundButton>
                        }
                        itemProps={tag => {
                            return { onClick: () => handleTagDelta(tag, true) }
                        }}
                        focused={() => focused == 1}
                    />
                }
            </Submenu>
            <Submenu
                label={
                    <Button
                        className={buttonStyle.root}
                        icon={<TagDismiss20Regular />}
                        appearance="subtle"
                        onClick={() => setFocused(2)}
                    >
                        <Text>{t("ctxMenu.remTag")}</Text>
                    </Button>
                }
                disabled={contextMenuProp?.data?.target != "assets"}
            >
                {
                    contextMenuProp?.data?.target != "folder" &&
                    <FilterableSearch
                        range={allTags}
                        searchKey={tag => tag.name}
                        component={tag =>
                            <CompoundButton
                                className={buttonStyle.root}
                                icon={<Tag20Regular />}
                                secondaryContent={tag.id}
                                appearance="subtle"
                                size="small"
                            >
                                <Text style={{ color: `#${tag.color}` }}>{tag.name}</Text>
                            </CompoundButton>
                        }
                        noMatch={
                            <CompoundButton appearance="transparent" size="small">
                                <Text>{t("ctxMenu.noTagFallback")}</Text>
                            </CompoundButton>
                        }
                        itemProps={tag => {
                            return { onClick: () => handleTagDelta(tag, false) }
                        }}
                        focused={() => focused == 2}
                    />
                }
            </Submenu>
            <CtxItem onClick={handleQuickRef}>
                <Button
                    className={buttonStyle.root}
                    icon={<DrawImage20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.quickRef")}</Text>
                </Button>
            </CtxItem>
            <CtxItem onClick={handleOpen} disabled={selectedItems?.data?.length != 1}>
                <Button
                    className={buttonStyle.root}
                    icon={<Open20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.open")}</Text>
                </Button>
            </CtxItem>
        </CtxMenu>
    )
}
