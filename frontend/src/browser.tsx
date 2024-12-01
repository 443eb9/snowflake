import { Button } from "@fluentui/react-components";
import { Settings20Regular } from "@fluentui/react-icons";
import { List, ListItem } from "@fluentui/react-list-preview";
import { main } from "../wailsjs/go/models";
import { } from "../wailsjs/go/main/App";

export default function Browser() {
    return (
        <>
            <Button icon={<Settings20Regular />}></Button>
            <List>
                <ListItem>
                </ListItem>
            </List>
        </>
    )
}
