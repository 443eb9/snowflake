import { useContext } from "react"
import { List, ListItem } from "@fluentui/react-list-preview"
import { Button, makeStyles, useToastController } from "@fluentui/react-components"
import { Collections20Regular } from "@fluentui/react-icons"
import { GetAssetsContainingTag, Tag } from "../backend"
import { allTagsContext, browsingFolderContext, contextMenuPropContext, selectedObjectsContext } from "../helpers/context-provider"
import TagName from "./tag-name"
import { TriggerEvent, useContextMenu } from "react-contexify"
import { CtxMenuId } from "./context-menu"
import ErrToast from "./err-toast"
import { GlobalToasterId } from "../main"
import { SelectedClassTag } from "./items-grid"

const buttonStyleHook = makeStyles({
    root: {
        width: "100%",
        justifyContent: "start"
    }
})

export default function TagsCollections() {
    const buttonStyle = buttonStyleHook()
    const browsingFolder = useContext(browsingFolderContext)
    const selectedObjects = useContext(selectedObjectsContext)
    const contextMenuProp = useContext(contextMenuPropContext)

    const { show: showCtxMenu } = useContextMenu({ id: CtxMenuId })
    const { dispatchToast } = useToastController(GlobalToasterId)

    const updateBrowsingFolder = async (tag: Tag) => {
        const assets = await GetAssetsContainingTag({ tag: tag.id })
            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

        if (browsingFolder?.data && assets) {
            selectedObjects?.setter([])
            document.querySelectorAll(`.${SelectedClassTag}`)
                .forEach(elem => elem.classList.remove(SelectedClassTag))
            browsingFolder.setter({
                id: tag.id,
                name: tag.name,
                content: assets.map(a => { return { id: a, ty: "asset" } }),
                specialTy: "collection",
            })
        }
    }

    const allTags = useContext(allTagsContext)
    if (!allTags || !allTags.data) {
        return <></>
    }

    return (
        <List>
            {
                allTags.data.map((tag, index) =>
                    <ListItem key={index}>
                        <Button
                            className={buttonStyle.root}
                            appearance="subtle"
                            icon={<Collections20Regular />}
                            style={{ color: `#${tag.color}` }}
                            onClick={() => updateBrowsingFolder(tag)}
                            onContextMenu={(ev: TriggerEvent) => {
                                contextMenuProp?.setter({
                                    target: "collection",
                                    extra: tag.id,
                                })
                                showCtxMenu({ event: ev })
                            }}
                        >
                            <TagName name={tag.name} />
                        </Button>
                    </ListItem>
                )
            }
        </List>
    )
}
