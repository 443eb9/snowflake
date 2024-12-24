import { useContext, useEffect, useRef, useState } from "react"
import ItemPreview from "./asset-preview"
import { GetItems, Item } from "../backend"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider"
import Selecto from "react-selecto";
import { darkenContentStyleHook } from "../helpers/styling";
import { mergeClasses, useToastController } from "@fluentui/react-components";
import { TriggerEvent, useContextMenu } from "react-contexify";
import ErrToast from "./toasts/err-toast";
import { GlobalToasterId } from "../main";
import { RecycleBinCtxMenuId } from "./context-menus/recycle-bin-context-menu";
import { decodeId, isAtRecycleBin } from "../util";
import { CollectionTagCtxMenuId } from "./context-menus/collection-tag-context-menu";

export const SelectableClassTag = "selectable-asset"
export const SelectedClassTag = "selected-asset"

export default function ItemsGrid() {
    const [items, setObjects] = useState<Item[] | undefined>()
    const selectoRef = useRef<Selecto & HTMLElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const boundRef = useRef<HTMLDivElement>(null)
    const darkenContentStyle = darkenContentStyleHook()

    const { show: showCtxMenu } = useContextMenu()
    const { dispatchToast } = useToastController(GlobalToasterId)

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const fileManipulation = useContext(fileManipulationContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const handleContextMenu = (ev: TriggerEvent) => {
        if (!browsingFolder?.data) { return }
        const currentSelected = selectedItems?.data?.length ?? 0

        if (selectoRef.current && ev.target && currentSelected < 2) {
            let target = ev.target as HTMLElement
            while (target.id.length == 0) {
                target = target.parentNode as HTMLElement
            }

            selectoRef.current.setSelectedTargets([target])

            selectedItems?.setter([decodeId(target.id)])
            target.classList.add(SelectedClassTag)
        }

        if (selectoRef.current) {
            contextMenuProp?.setter({
                ty: "assets",
                data: selectoRef.current.getSelectedTargets().map(node => decodeId(node.id).id),
            })
        }

        if (isAtRecycleBin(browsingFolder.data.subTy)) {
            showCtxMenu({ event: ev, id: RecycleBinCtxMenuId })
        } else {
            showCtxMenu({ event: ev, id: CollectionTagCtxMenuId })
        }
    }

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data) {
                setObjects(undefined)
                return
            }

            console.log(browsingFolder.data)
            const objects = await GetItems({ items: browsingFolder.data.content, filter: "all" })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (objects) {
                setObjects(objects)
            }

            if (selectoRef.current) {
                selectoRef.current.setSelectedTargets([])
            }
        }

        fetch()
    }, [browsingFolder?.data])

    return (
        <div
            className={mergeClasses("flex w-full flex-col gap-2 rounded-md h-full overflow-y-auto", darkenContentStyle.root)}
            ref={boundRef}
        >
            {
                boundRef.current &&
                <Selecto
                    ref={selectoRef}
                    container={gridRef.current}
                    boundContainer={boundRef.current}
                    selectableTargets={[`.${SelectableClassTag}`]}
                    hitRate={0}
                    selectByClick
                    toggleContinueSelect={"shift"}
                    dragCondition={() => fileManipulation?.data?.op != "rename"}
                    onSelect={ev => {
                        ev.added.forEach(elem => elem.classList.add(SelectedClassTag))
                        ev.removed.forEach(elem => elem.classList.remove(SelectedClassTag))

                        const removed = ev.removed.map(elem => decodeId(elem.id))
                        const selected = ev.added.map(elem => decodeId(elem.id))
                            .concat(selectedItems?.data ?? [])
                            .filter(id => removed.find(r => r.id == id.id) == undefined)
                            .filter(id => id != null)
                        selectedItems?.setter(selected)
                    }}
                />
            }
            {
                items &&
                <div className="flex w-full flex-wrap gap-2 overflow-x-hidden" ref={gridRef}>
                    {
                        items.map((item, index) =>
                            <ItemPreview
                                key={index}
                                item={item}
                                onContextMenu={handleContextMenu}
                            />
                        )
                    }
                </div>
            }
        </div>
    )
}
