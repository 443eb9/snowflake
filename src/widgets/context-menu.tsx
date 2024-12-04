import { Menu as CtxMenu, Item as CtxItem } from "react-contexify";
import "react-contexify/dist/ReactContexify.css";

export const CtxMenuId = "context-menu"

export default function ContextMenu() {
    return (
        <CtxMenu id={CtxMenuId}>
            <CtxItem>
                Test Item
            </CtxItem>
            <CtxItem>
                Test Item
            </CtxItem>
        </CtxMenu>
    )
}
