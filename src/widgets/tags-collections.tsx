import { useContext } from "react"
import { List, ListItem } from "@fluentui/react-list-preview"
import { Button, makeStyles } from "@fluentui/react-components"
import { Collections20Regular } from "@fluentui/react-icons"
import { GetAssetsContainingTag, Tag } from "../backend"
import { allTagsContext, browsingFolderContext } from "../context-provider"
import TagName from "./tag-name"

const buttonStyleHook = makeStyles({
    root: {
        width: "100%",
        justifyContent: "start"
    }
})

export default function TagsCollections() {
    const buttonStyle = buttonStyleHook()
    const browsingFolder = useContext(browsingFolderContext)

    const updateBrowsingFolder = async (tag: Tag) => {
        const assets = await GetAssetsContainingTag({ tag: tag.meta.id })
            .catch(err => {
                // TODO error handling
                console.error(err)
            })

        if (browsingFolder?.data && assets) {
            browsingFolder.setter({
                id: undefined,
                content: assets,
                path: `Collection ${tag.name}`,
                collection: true,
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
                        >
                            <TagName name={tag.name} />
                        </Button>
                    </ListItem>
                )
            }
        </List>
    )
}
