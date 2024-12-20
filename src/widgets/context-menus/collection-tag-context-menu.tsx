import { useContext, useEffect, useState } from "react"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider"
import { Item, ItemParams, Menu, Submenu } from "react-contexify"
import { Collection, CreateTags, GetCollectionTree, OpenWithDefaultApp, QuickRef } from "../../backend"
import { Button, CompoundButton, makeStyles, Text, useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../../main"
import { ArrowCounterclockwise20Regular, ArrowForward20Regular, Collections20Regular, CollectionsAdd20Regular, Delete20Regular, DrawImage20Regular, Edit20Regular, Open20Regular, Tag20Regular } from "@fluentui/react-icons"
import { t } from "../../i18n"
import ErrToast from "../toasts/err-toast"
import FilterableSearch from "../../components/filterable-search"

export const CollectionTagCtxMenuId = "collectiontagctxmenu"

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

export default function CollectionTagContextMenu() {
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const [allCollections, setAllCollections] = useState<Collection[] | undefined>()
    const [focused, setFocused] = useState(-1)

    const { dispatchToast } = useToastController(GlobalToasterId)

    const buttonStyle = buttonStyleHook()

    useEffect(() => {
        async function fetch() {
            const allCollections = await GetCollectionTree()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (allCollections) {
                setAllCollections(Array.from(allCollections.values()))
            }
        }

        fetch()
    }, [])

    const handleRefresh = () => {
        window.location.reload()
    }

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
        const ty = fileManipulation?.data?.id[0].ty
        if (fileManipulation?.data && (ty == "collection" || ty == "tag")) {
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

    const handleTagCreation = async (ev: ItemParams) => {
        if (!ev.triggerEvent.target) { return }
        let parent = ev.triggerEvent.target as HTMLElement
        while (parent.id.length == 0 && parent.parentNode) {
            parent = parent.parentNode as HTMLElement
        }

        if (parent.id.length > 0) {
            await CreateTags({ tagNames: ["New Tag"], parent: parent.id })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        }
    }

    const handleCollectionCreation = () => {

    }

    const handleMove = (dst: Collection) => {
        const target = contextMenuProp?.data?.target
        if (!target) { return }

        switch (target) {
            case "assets":
                if (selectedItems?.data) {
                    fileManipulation?.setter({
                        id: selectedItems?.data,
                        op: "move",
                        submit: [dst.id],
                    })
                }
                break
            case "tag":
                if (contextMenuProp.data?.extra) {
                    fileManipulation?.setter({
                        id: [{ id: contextMenuProp.data?.extra, ty: "tag" }],
                        op: "move",
                        submit: [dst.id],
                    })
                }
                break
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

    if (!allCollections) {
        return <></>
    }

    return (
        <Menu id={CollectionTagCtxMenuId} theme="dark">
            <Item onClick={handleRefresh}>
                <Button
                    className={buttonStyle.root}
                    icon={<ArrowCounterclockwise20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.refresh")}</Text>
                </Button>
            </Item>
            <Item onClick={handleDelete}>
                <Button
                    className={buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.del")}</Text>
                </Button>
            </Item>
            <Item onClick={handleRename} disabled={multipleSelected}>
                <Button
                    className={buttonStyle.root}
                    icon={<Edit20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.rename")}</Text>
                </Button>
            </Item>
            <Item onClick={handleCollectionCreation}>
                <Button
                    className={buttonStyle.root}
                    icon={<CollectionsAdd20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.createCollection")}</Text>
                </Button>
            </Item>
            <Item onClick={handleTagCreation}>
                <Button
                    className={buttonStyle.root}
                    icon={<Tag20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.createTag")}</Text>
                </Button>
            </Item>
            <Submenu
                label={
                    <Button
                        className={buttonStyle.root}
                        icon={<ArrowForward20Regular />}
                        appearance="subtle"
                        onClick={() => setFocused(0)}
                    >
                        <Text>{t("ctxMenu.moveTo")}</Text>
                    </Button>
                }
            >
                <FilterableSearch
                    range={allCollections}
                    searchKey={collection => collection.name}
                    component={collection =>
                        <CompoundButton
                            className={buttonStyle.root}
                            icon={<Collections20Regular />}
                            secondaryContent={collection.id}
                            appearance="subtle"
                            size="small"
                        >
                            <Text>{collection.name}</Text>
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
            <Item onClick={handleQuickRef}>
                <Button
                    className={buttonStyle.root}
                    icon={<DrawImage20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.quickRef")}</Text>
                </Button>
            </Item>
            <Item onClick={handleOpen} disabled={selectedItems?.data?.length != 1}>
                <Button
                    className={buttonStyle.root}
                    icon={<Open20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.open")}</Text>
                </Button>
            </Item>
        </Menu>
    )
}
