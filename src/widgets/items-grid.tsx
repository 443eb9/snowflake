import { useContext, useEffect, useRef, useState } from "react"
import AssetPreview from "./asset-preview"
import { GetItems, Item } from "../backend"
import { browsingFolderContext, contextMenuPropContext, fileManipulationContext, selectedItemsContext } from "../helpers/context-provider"
import Selecto from "react-selecto";
import { darkenContentStyleHook } from "../helpers/styling";
import { mergeClasses, useToastController } from "@fluentui/react-components";
import { TriggerEvent, useContextMenu } from "react-contexify";
import { CtxMenuId } from "./context-menu";
import ErrToast from "./err-toast";
import { GlobalToasterId } from "../main";
import { RecycleBinCtxMenuId } from "./recycle-bin-context-menu";
import FolderPreview from "./folder-preview";
import { decodeId } from "../util";

export const SelectableClassTag = "selectable-asset"
export const SelectedClassTag = "selected-asset"

export default function ItemsGrid() {
    const [objects, setObjects] = useState<Item[] | undefined>()
    const selectoRef = useRef<Selecto & HTMLElement>(null)
    const gridRef = useRef<HTMLDivElement>(null)
    const darkenContentStyle = darkenContentStyleHook()

    const { show: showCommonCtxMenu } = useContextMenu({ id: CtxMenuId })
    const { show: showRecycleBinCtxMenu } = useContextMenu({ id: RecycleBinCtxMenuId })
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

        contextMenuProp?.setter({
            target: "assets",
            extra: undefined,
        })

        if (browsingFolder.data.subTy == "recycleBin") {
            showRecycleBinCtxMenu({ event: ev })
        } else {
            showCommonCtxMenu({ event: ev })
        }
    }

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data) {
                setObjects(undefined)
                return
            }

            const objects = await GetItems({ items: browsingFolder.data.content.map(c => c.id) })
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
        <div className={mergeClasses("flex w-full flex-col gap-2 rounded-md h-full overflow-y-auto", darkenContentStyle.root)}>
            <Selecto
                ref={selectoRef}
                container={gridRef.current}
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
                    console.log(selected)
                    selectedItems?.setter(selected)
                }}
            />
            {
                objects &&
                <div className="flex w-full flex-wrap gap-2 overflow-x-hidden" ref={gridRef}>
                    {
                        objects.map((object, index) => {
                            const value = Object.entries(object)[0]
                            const ty = value[0]
                            const data = value[1]

                            switch (ty) {
                                case "asset":
                                    return (
                                        <AssetPreview
                                            key={index}
                                            asset={data}
                                            onContextMenu={handleContextMenu}
                                        />
                                    )
                                case "folder":
                                    return (
                                        <FolderPreview
                                            key={index}
                                            folder={data}
                                            onContextMenu={handleContextMenu}
                                        />
                                    )
                            }
                        })
                    }
                </div>
            }
        </div>
    )
}
