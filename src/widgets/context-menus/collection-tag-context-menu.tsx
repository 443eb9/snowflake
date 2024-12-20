import { useContext, useEffect, useState } from "react"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider"
import { Item, ItemParams, Menu, Submenu } from "react-contexify"
import { Collection, GetCollectionTree, OpenWithDefaultApp, QuickRef } from "../../backend"
import { Button, CompoundButton, makeStyles, Text, useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../../main"
import { ArrowCounterclockwise20Regular, ArrowForward20Regular, Collections20Regular, CollectionsAdd20Regular, Delete20Regular, DrawImage20Regular, Edit20Regular, Open20Regular, Tag20Regular } from "@fluentui/react-icons"
import { t } from "../../i18n"
import ErrToast from "../toasts/err-toast"
import FilterableSearch from "../../components/filterable-search"
import { GetNodeId } from "../../util"

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
        if (!ev.triggerEvent.target) { return }
        const item = GetNodeId(ev.triggerEvent.target as HTMLElement)
        const ty = fileManipulation?.data?.id[0].ty

        if (ty && item) {
            fileManipulation?.setter({
                id: [{ id: item, ty }],
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

    const handleTagCreation = (ev: ItemParams) => {
        if (!ev.triggerEvent.target) { return }
        const parent = GetNodeId(ev.triggerEvent.target as HTMLElement)

        if (parent) {
            fileManipulation?.setter({
                id: [{ id: parent, ty: "collection" }],
                op: "create",
                submit: ["New Tag", "tag"],
            })
        }
    }

    const handleCollectionCreation = (ev: ItemParams) => {
        if (!ev.triggerEvent.target) { return }
        const parent = GetNodeId(ev.triggerEvent.target as HTMLElement)

        if (parent) {
            fileManipulation?.setter({
                id: [{ id: parent, ty: "collection" }],
                op: "create",
                submit: ["New Collection", "collection"],
            })
        }
    }

    const handleMove = (dst: Collection) => {
        const target = contextMenuProp?.data?.target
        if (!target) { return }

        switch (target) {
            case "collection":
                if (contextMenuProp.data?.extra) {
                    console.log("AAA")
                    fileManipulation?.setter({
                        id: [{ id: contextMenuProp.data?.extra, ty: "collection" }],
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
            case "tag":
                if (contextMenuProp.data?.extra) {
                    await QuickRef({ ty: { tag: contextMenuProp.data?.extra } })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
            case "assets":
                if (selectedItems?.data) {
                    await QuickRef({ ty: { asset: selectedItems.data.map(a => a.id) } })
                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                }
                break
        }
    }

    const handleOpen = () => {
        if (browsingFolder?.data?.content) {
            browsingFolder.data.content.forEach(async asset => {
                await OpenWithDefaultApp({ asset: asset.id })
                    .catch(err => dispatchToast(<ErrToast body={err} />))
            })
        }
    }

    const multipleSelected = contextMenuProp?.data?.target == "assets" &&
        selectedItems?.data?.length != undefined && selectedItems.data.length > 1
    const onTag = fileManipulation?.data?.id.length != 0 && fileManipulation?.data?.id[0].ty == "tag"

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
            <Item onClick={handleCollectionCreation} disabled={onTag}>
                <Button
                    className={buttonStyle.root}
                    icon={<CollectionsAdd20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.createCollection")}</Text>
                </Button>
            </Item>
            <Item onClick={handleTagCreation} disabled={onTag}>
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
            <Item onClick={handleOpen} disabled={!onTag}>
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
