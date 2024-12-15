import { useContext, useEffect, useState } from "react";
import { Menu as CtxMenu, Item as CtxItem, useContextMenu } from "react-contexify";
import { browsingFolderContext, fileManipulationContext, selectedObjectsContext } from "../helpers/context-provider";
import { Button, makeStyles, mergeClasses, Text, useToastController } from "@fluentui/react-components";
import { ArrowCounterclockwise20Regular } from "@fluentui/react-icons";
import { GetRecycleBin, RecoverObjects } from "../backend";
import { GlobalToasterId } from "../main";
import ErrToast from "./err-toast";
import { t } from "../i18n";
import { decodeItemObject } from "../util";

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
    const selectedObjects = useContext(selectedObjectsContext)
    const fileManipulation = useContext(fileManipulationContext)

    const buttonStyle = buttonStyleHook()
    const confirmTextStyle = confirmTextStyleHook()
    const { dispatchToast } = useToastController(GlobalToasterId)

    const [onConfirm, setOnConfirm] = useState(false)

    const handleRecover = async () => {
        if (selectedObjects?.data && browsingFolder?.data) {
            await RecoverObjects({ objects: selectedObjects.data.map(item => item.id) })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            const recycleBin = await GetRecycleBin()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (recycleBin) {
                selectedObjects.setter([])
                browsingFolder.setter({
                    ...browsingFolder.data,
                    content: recycleBin.map(obj => {
                        const decoded = decodeItemObject(obj)
                        return { id: decoded.item.id, ty: decoded.ty }
                    }),
                })

                // update folder tree
                fileManipulation?.setter({
                    id: [],
                    op: "create",
                    submit: [],
                })
            }
        }
    }

    const handlePermanentlyDelete = async () => {
        if (onConfirm && selectedObjects?.data) {
            fileManipulation?.setter({
                id: selectedObjects?.data,
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
                    icon={<ArrowCounterclockwise20Regular />}
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
