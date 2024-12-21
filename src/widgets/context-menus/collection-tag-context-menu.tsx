import { useContext, useEffect, useState } from "react"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider"
import { Item, Menu, Submenu, useContextMenu } from "react-contexify"
import { Collection, GetCollectionTree, ItemId, OpenWithDefaultApp, QuickRef } from "../../backend"
import { Button, CompoundButton, makeStyles, Popover, PopoverSurface, PopoverTrigger, Text, useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../../main"
import { ArrowCounterclockwise20Regular, ArrowForward20Regular, Checkmark20Regular, Collections20Regular, CollectionsAdd20Regular, Color20Regular, Delete20Regular, Dismiss20Regular, DrawImage20Regular, Edit20Regular, Open20Regular, Tag20Regular } from "@fluentui/react-icons"
import { t } from "../../i18n"
import ErrToast from "../toasts/err-toast"
import FilterableSearch from "../../components/filterable-search"
import { ColorArea, ColorPicker, ColorSlider } from "@fluentui/react-color-picker-preview"
import { TinyColor } from "@ctrl/tinycolor";

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
    const [color, setColor] = useState<TinyColor | undefined>()

    const { dispatchToast } = useToastController(GlobalToasterId)
    const { hideAll } = useContextMenu({ id: CollectionTagCtxMenuId })

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

    const handleDelete = () => {
        const data = contextMenuProp?.data
        if (data) {
            switch (data.ty) {
                case "assets":
                    fileManipulation?.setter({
                        id: data.data.map(id => { return { id, ty: "asset" } }),
                        op: "deletion",
                        submit: [],
                    })
                    break
                case "collection":
                case "tag":
                    fileManipulation?.setter({
                        id: [data],
                        op: "deletion",
                        submit: [],
                    })
                    break
            }
        }
    }

    const handleRename = () => {
        if (!contextMenuProp?.data) { return }

        let id: ItemId | undefined = undefined;
        switch (contextMenuProp.data.ty) {
            case "assets":
                if (contextMenuProp.data.data.length == 1) {
                    id = {
                        id: contextMenuProp.data.data[0],
                        ty: "asset"
                    }
                }
                break
            case "collection":
                id = {
                    id: contextMenuProp.data.id,
                    ty: "collection",
                }
                break
            case "tag":
                id = {
                    id: contextMenuProp.data.id,
                    ty: "tag",
                }
                break
        }
        if (id == undefined) { return }

        fileManipulation?.setter({
            id: [id],
            op: "rename",
            submit: undefined,
        })
    }

    const handleTagCreation = () => {
        if (contextMenuProp?.data && contextMenuProp.data.ty == "collection") {
            fileManipulation?.setter({
                id: [contextMenuProp.data],
                op: "create",
                submit: ["New Tag", "tag"],
            })
        }
    }

    const handleCollectionCreation = () => {
        if (contextMenuProp?.data && contextMenuProp.data.ty == "collection") {
            fileManipulation?.setter({
                id: [contextMenuProp.data],
                op: "create",
                submit: ["New Collection", "collection"],
            })
        }
    }

    const handleMove = (dst: Collection) => {
        const ty = contextMenuProp?.data?.ty
        if (!contextMenuProp?.data) { return }

        switch (ty) {
            case "collection":
            case "tag":
                fileManipulation?.setter({
                    id: [contextMenuProp.data],
                    op: "move",
                    submit: [dst.id],
                })
                break
        }
    }

    const handleQuickRef = async () => {
        const ty = contextMenuProp?.data?.ty
        if (!contextMenuProp?.data) { return }

        switch (ty) {
            case "tag":
                await QuickRef({ ty: { tag: contextMenuProp.data.id } })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                break
            case "assets":
                if (selectedItems?.data) {
                    await QuickRef({ ty: { asset: contextMenuProp.data.data } })
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

    const ty = contextMenuProp?.data?.ty
    const multipleSelected = contextMenuProp?.data?.ty == "assets" && contextMenuProp.data.data.length > 1

    if (!allCollections || !ty || !contextMenuProp.data) {
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
            <Item disabled={ty != "collection"} closeOnClick={false}>
                <Popover>
                    <PopoverTrigger>
                        <Button
                            className={buttonStyle.root}
                            icon={<Color20Regular />}
                            appearance="subtle"
                        >
                            <Text>{t("ctxMenu.recolorCollection")}</Text>
                        </Button>
                    </PopoverTrigger>
                    <PopoverSurface>
                        <ColorPicker
                            color={color?.toHsv() ?? new TinyColor("ffffff").toHsv()}
                            onColorChange={(_, data) => setColor(new TinyColor(data.color))}
                        >
                            <ColorArea />
                            <ColorSlider />
                        </ColorPicker>
                        <div className="flex gap-2 items-center">
                            <Button
                                icon={<Dismiss20Regular />}
                                onClick={() => {
                                    fileManipulation?.setter(undefined)
                                    hideAll()
                                }}
                            />
                            <Button
                                icon={<Checkmark20Regular />}
                                onClick={() => {
                                    if (contextMenuProp.data && contextMenuProp.data.ty == "collection" && color) {
                                        fileManipulation?.setter({
                                            id: [contextMenuProp.data],
                                            op: "recolor",
                                            submit: [color.toHex()],
                                        })
                                    }
                                    hideAll()
                                }}
                            />
                            <Text
                                size={400}
                                font="monospace"
                                style={{
                                    color: `#${color?.toHex()}`,
                                }}
                            >
                                {color?.toHex()}
                            </Text>
                        </div>
                    </PopoverSurface>
                </Popover>
            </Item>
            <Item onClick={handleCollectionCreation} disabled={ty != "collection"}>
                <Button
                    className={buttonStyle.root}
                    icon={<CollectionsAdd20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.createCollection")}</Text>
                </Button>
            </Item>
            <Item onClick={handleTagCreation} disabled={ty != "collection"}>
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
                disabled={ty == "assets"}
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
            <Item onClick={handleOpen} disabled={ty == "collection"}>
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
