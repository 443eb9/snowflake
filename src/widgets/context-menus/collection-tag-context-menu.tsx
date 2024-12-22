import { useContext, useEffect, useState } from "react"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider"
import { Item, Menu, Submenu, useContextMenu } from "react-contexify"
import { AddTagToAssets, Collection, GetAllTags, GetCollectionTree, ItemId, OpenWithDefaultApp, QuickRef, RemoveTagFromAssets, Tag } from "../../backend"
import { Button, CompoundButton, makeStyles, Popover, PopoverSurface, PopoverTrigger, Radio, RadioGroup, Text, useToastController } from "@fluentui/react-components"
import { GlobalToasterId } from "../../main"
import { ArrowCounterclockwise20Regular, ArrowForward20Regular, Checkmark20Regular, Collections20Regular, CollectionsAdd20Regular, Color20Regular, Delete20Regular, Dismiss20Regular, DrawImage20Regular, Edit20Regular, Eraser20Regular, Group20Regular, Open20Regular, Tag20Regular, TagMultiple20Regular } from "@fluentui/react-icons"
import { t } from "../../i18n"
import ErrToast from "../toasts/err-toast"
import FilterableSearch from "../../components/filterable-search"
import { ColorArea, ColorPicker, ColorSlider } from "@fluentui/react-color-picker-preview"
import { TinyColor } from "@ctrl/tinycolor";
import FallbackableText from "../../components/fallbackable-text"

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
    const [allTags, setAllTags] = useState<Tag[] | undefined>()
    const [color, setColor] = useState<TinyColor>(new TinyColor("ffffff"))
    const [tagModification, setTagModification] = useState<"add" | "remove">("add")
    const [deletionConfirm, setDeletionConfirm] = useState(false)

    const { dispatchToast } = useToastController(GlobalToasterId)
    const { hideAll } = useContextMenu({ id: CollectionTagCtxMenuId })

    const buttonStyle = buttonStyleHook()

    async function fetchAllCollections() {
        const allCollections = await GetCollectionTree({ noSpecial: true })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (allCollections) {
            setAllCollections(Array.from(allCollections.values()))
        }
    }

    async function fetchAllTags() {
        const allTags = await GetAllTags()
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (allTags) {
            setAllTags(allTags)
        }
    }

    useEffect(() => {
        fetchAllCollections()
        fetchAllTags()
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
                    hideAll()
                    break
                case "collection":
                case "tag":
                    if (deletionConfirm) {
                        fileManipulation?.setter({
                            id: [data],
                            op: "deletion",
                            submit: [],
                        })
                        hideAll()
                    } else {
                        setDeletionConfirm(true)
                    }
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

    const handleTagModification = async (tag: Tag) => {
        if (selectedItems?.data) {
            const assets = selectedItems.data.map(id => id.id)
            switch (tagModification) {
                case "add":
                    await AddTagToAssets({ tag: tag.id, assets })
                        .catch(err => dispatchToast(<ErrToast body={err} />))
                    break
                case "remove":
                    await RemoveTagFromAssets({ tag: tag.id, assets })
                        .catch(err => dispatchToast(<ErrToast body={err} />))
                    break
            }
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

    const handleTagRegroup = (group: string) => {
        if (contextMenuProp?.data && contextMenuProp.data.ty == "tag") {
            fileManipulation?.setter({
                id: [contextMenuProp.data],
                op: "regroup",
                submit: [group],
            })
        }
        hideAll()
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
        hideAll()
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

    if (!allCollections || !ty || !contextMenuProp.data || !allTags) {
        return <></>
    }

    return (
        <Menu
            id={CollectionTagCtxMenuId}
            theme="dark"
            onVisibilityChange={vis => {
                if (vis) {
                    setDeletionConfirm(false)
                }
            }}
        >
            <Item onClick={handleRefresh}>
                <Button
                    className={buttonStyle.root}
                    icon={<ArrowCounterclockwise20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.refresh")}</Text>
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
                            color={color.toHsv()}
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
                            <Button
                                icon={<Eraser20Regular />}
                                onClick={() => {
                                    if (contextMenuProp.data && contextMenuProp.data.ty == "collection") {
                                        fileManipulation?.setter({
                                            id: [contextMenuProp.data],
                                            op: "recolor",
                                            submit: [""],
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
            <Item closeOnClick={false}>
                <Submenu
                    label={
                        <Button
                            className={buttonStyle.root}
                            icon={<Group20Regular />}
                            appearance="subtle"
                        >
                            <Text>{t("ctxMenu.regroupTag")}</Text>
                        </Button>
                    }
                    disabled={ty != "tag"}
                    className="w-full"
                >
                    <div className="flex flex-col gap-2">
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
                                    <FallbackableText
                                        style={collection.color ? { color: `#${collection.color}` } : undefined}
                                        text={collection.name}
                                        fallback={t("collectionName.unnamed")}
                                    />
                                </CompoundButton>
                            }
                            noMatch={
                                <CompoundButton appearance="transparent" size="small">
                                    <Text>{t("ctxMenu.noFolderFallback")}</Text>
                                </CompoundButton>
                            }
                            itemProps={collection => {
                                return { onClick: () => handleTagRegroup(collection.id) }
                            }}
                        />
                        <div className="flex">
                            <Button
                                icon={<Eraser20Regular />}
                                className={buttonStyle.root}
                                size="large"
                                appearance="subtle"
                                onClick={() => handleTagRegroup("")}
                            >
                                <Text>{t("ctxMenu.regroupTag.clear")}</Text>
                            </Button>
                            <Button
                                icon={<ArrowCounterclockwise20Regular />}
                                className={buttonStyle.root}
                                size="large"
                                appearance="subtle"
                                onClick={fetchAllCollections}
                            >
                                <Text>{t("ctxMenu.refresh")}</Text>
                            </Button>
                        </div>
                    </div>
                </Submenu>
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
            <Item closeOnClick={false}>
                <Submenu
                    label={
                        <Button
                            className={buttonStyle.root}
                            icon={<ArrowForward20Regular />}
                            appearance="subtle"
                        >
                            <Text>{t("ctxMenu.moveTo")}</Text>
                        </Button>
                    }
                    disabled={ty == "assets"}
                    className="w-full"
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
                                <FallbackableText
                                    style={collection.color ? { color: `#${collection.color}` } : undefined}
                                    text={collection.name}
                                    fallback={t("collectionName.unnamed")}
                                />
                            </CompoundButton>
                        }
                        noMatch={
                            <CompoundButton appearance="transparent" size="small">
                                <Text>{t("ctxMenu.noFolderFallback")}</Text>
                            </CompoundButton>
                        }
                        itemProps={collection => {
                            return { onClick: () => handleMove(collection) }
                        }}
                    />
                    <Button
                        icon={<ArrowCounterclockwise20Regular />}
                        className={buttonStyle.root}
                        size="large"
                        appearance="subtle"
                        onClick={fetchAllCollections}
                    >
                        <Text>{t("ctxMenu.refresh")}</Text>
                    </Button>
                </Submenu>
            </Item>
            <Item closeOnClick={false}>
                <Submenu
                    label={
                        <Button
                            className={buttonStyle.root}
                            icon={<TagMultiple20Regular />}
                            appearance="subtle"
                        >
                            <Text>{t("ctxMenu.modifyTags")}</Text>
                        </Button>
                    }
                    disabled={ty != "assets"}
                    className="w-full"
                >
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
                                <FallbackableText
                                    style={tag.color ? { color: `#${tag.color}` } : undefined}
                                    text={tag.name}
                                    fallback={t("tagName.unnamed")}
                                />
                            </CompoundButton>
                        }
                        noMatch={
                            <CompoundButton appearance="transparent" size="small">
                                <Text>{t("ctxMenu.noTagFallback")}</Text>
                            </CompoundButton>
                        }
                        itemProps={tag => {
                            return { onClick: () => handleTagModification(tag) }
                        }}
                    />
                    <div className="flex">
                        <RadioGroup defaultValue={"add"} layout="horizontal">
                            <Radio
                                value={"add"}
                                onClick={() => setTagModification("add")}
                                label={t("ctxMenu.modifyTags.add")}
                            />
                            <Radio
                                value={"remove"}
                                onClick={() => setTagModification("remove")}
                                label={t("ctxMenu.modifyTags.remove")}
                            />
                        </RadioGroup>
                        <Button
                            icon={<ArrowCounterclockwise20Regular />}
                            className={buttonStyle.root}
                            size="large"
                            appearance="subtle"
                            onClick={fetchAllTags}
                        >
                            <Text>{t("ctxMenu.refresh")}</Text>
                        </Button>
                    </div>
                </Submenu>
            </Item>
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
            <Item onClick={handleDelete} closeOnClick={false}>
                <Button
                    className={buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                >
                    <Text>{t(deletionConfirm ? "ctxMenu.delPerm.confirm" : "ctxMenu.del")}</Text>
                </Button>
            </Item>
        </Menu>
    )
}
