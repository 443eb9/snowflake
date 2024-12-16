import { useContext, useState } from "react";
import { Menu as CtxMenu, Item as CtxItem } from "react-contexify";
import { browsingFolderContext, fileManipulationContext, selectedItemsContext } from "../../helpers/context-provider";
import { Button, makeStyles, mergeClasses, Text } from "@fluentui/react-components";
import { ArrowCounterclockwise20Regular, Delete20Regular } from "@fluentui/react-icons";
import { t } from "../../i18n";

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
    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const buttonStyle = buttonStyleHook()
    const confirmTextStyle = confirmTextStyleHook()

    const [onConfirm, setOnConfirm] = useState(false)

    const handleRecover = async () => {
        if (selectedItems?.data && browsingFolder?.data) {
            fileManipulation?.setter({
                id: selectedItems.data,
                op: "recover",
                submit: [],
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

    return (
        <CtxMenu
            id={RecycleBinCtxMenuId}
            theme="dark"
            onVisibilityChange={() => setOnConfirm(false)}
        >
            <CtxItem onClick={handleRecover}>
                <Button
                    className={buttonStyle.root}
                    icon={<ArrowCounterclockwise20Regular />}
                    appearance="subtle"
                >
                    <Text>{t("ctxMenu.recover")}</Text>
                </Button>
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
