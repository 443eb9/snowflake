import { useContext, useEffect, useState } from "react";
import { Menu as CtxMenu, Item as CtxItem, Submenu } from "react-contexify";
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider";
import { Button, CompoundButton, makeStyles, mergeClasses, Text, useToastController } from "@fluentui/react-components";
import { ArrowCounterclockwise20Regular, Collections20Regular, Delete20Regular } from "@fluentui/react-icons";
import { t } from "../../i18n";
import FilterableSearch from "../../components/filterable-search";
import { Collection, GetCollectionTree } from "../../backend";
import { GlobalToasterId } from "../../main";
import ErrToast from "../toasts/err-toast";
import FallbackableText from "../../components/fallbackable-text";

export const RecycleBinCtxMenuId = "recycleBinCtxMenu"

const buttonStyleHook = makeStyles({
    root: {
        "width": "100%",
        "justifyContent": "start",
    }
})

const confirmTextStyleHook = makeStyles({
    root: {
        "color": "var(--colorPaletteRedForeground1)"
    }
})

export default function RecycleBinContextMenu() {
    const [allCollections, setAllCollections] = useState<Collection[] | undefined>()
    const [onConfirm, setOnConfirm] = useState(false)

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const buttonStyle = buttonStyleHook()
    const confirmTextStyle = confirmTextStyleHook()
    const { dispatchToast } = useToastController(GlobalToasterId)

    async function fetchAllCollections() {
        const allCollections = await GetCollectionTree({ noSpecial: false })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        if (allCollections) {
            setAllCollections(Array.from(allCollections.values()))
        }
    }

    useEffect(() => {
        fetchAllCollections()
    }, [])

    const handleRecover = async (parentOverride: string | undefined) => {
        if (selectedItems?.data && browsingFolder?.data) {
            fileManipulation?.setter({
                id: selectedItems.data,
                op: "recover",
                submit: [parentOverride ?? ""],
            })
        }
    }

    const handlePermanentlyDelete = async () => {
        if (onConfirm && selectedItems?.data) {
            fileManipulation?.setter({
                id: selectedItems?.data,
                op: "deletionPermanent",
                submit: [],
            })
            setOnConfirm(false)
        } else {
            setOnConfirm(true)
        }
    }

    const ty = contextMenuProp?.data?.ty
    if (!allCollections || !ty) {
        return <></>
    }

    return (
        <CtxMenu
            id={RecycleBinCtxMenuId}
            theme="dark"
            onVisibilityChange={() => setOnConfirm(false)}
        >
            <CtxItem onClick={() => handleRecover("")}>
                <Button
                    className={buttonStyle.root}
                    icon={<ArrowCounterclockwise20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.recover")}</Text>
                </Button>
            </CtxItem>
            <CtxItem closeOnClick={false}>
                <Submenu
                    label={
                        <Button
                            className={buttonStyle.root}
                            icon={<ArrowCounterclockwise20Regular />}
                            appearance="subtle"
                        >
                            <Text>{t("ctxMenu.recoverInto")}</Text>
                        </Button>
                    }
                    disabled={ty == "asset"}
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
                            return { onClick: () => handleRecover(collection.id) }
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
            </CtxItem>
            <CtxItem onClick={handlePermanentlyDelete} closeOnClick={onConfirm}>
                <Button
                    className={onConfirm ? mergeClasses(buttonStyle.root, confirmTextStyle.root) : buttonStyle.root}
                    icon={<Delete20Regular />}
                    appearance="subtle"
                >
                    <Text className={onConfirm ? confirmTextStyle.root : ""}>
                        {t(onConfirm ? "ctxMenu.delPerm.confirm" : "ctxMenu.delPerm")}
                    </Text>
                </Button>
            </CtxItem>
        </CtxMenu>
    )
}
