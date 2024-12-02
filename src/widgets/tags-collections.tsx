import { useContext } from "react"
import { List, ListItem } from "@fluentui/react-list-preview"
import { Button, makeStyles } from "@fluentui/react-components"
import { Collections20Regular } from "@fluentui/react-icons"
import { allTagsContext, browsingFolderContext } from "../app"
import { GetAssetsContainingTag } from "../backend"

const buttonStyleHook = makeStyles({
    root: {
        width: "100%",
        justifyContent: "start"
    }
})

export default function TagsCollections() {
    const buttonStyle = buttonStyleHook()
    const browsingFolder = useContext(browsingFolderContext)

    const updateBrowsingFolder = async (tagId: string) => {
        const assets = await GetAssetsContainingTag({ tag: tagId })
            .catch(err => {
                // TODO error handling
                console.error(err)
            })

        if (browsingFolder?.data && assets) {
            browsingFolder.setter({
                content: assets,
                path: ""
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
                            onClick={() => updateBrowsingFolder(tag.meta.id)}
                        >
                            {tag.name}
                        </Button>
                    </ListItem>
                )
            }
        </List>
    )
}
