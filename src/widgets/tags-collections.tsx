import { useEffect, useState } from "react"
import { List, ListItem } from "@fluentui/react-list-preview"
import { Button } from "@fluentui/react-components"
import { GetAllTags, Tag } from "../backend"

export default function TagsCollections() {
    const [allTags, setAllTags] = useState<Tag[] | undefined>()

    useEffect(() => {
        if (allTags) { return }
        async function fetch() {
            const allTags = await GetAllTags()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            if (allTags) {
                setAllTags(allTags)
            }
        }

        fetch()
    }, [])

    if (!allTags) {
        return <></>
    }

    return (
        <List>
            {
                allTags.map((tag, index) =>
                    <ListItem key={index}>
                        <Button
                            appearance="subtle"
                            style={{ color: `#${tag.color}` }}
                        >
                            {tag.name}
                        </Button>
                    </ListItem>
                )
            }
        </List>
    )
}
