import { Text } from "@fluentui/react-components";
import { List, ListItem } from "@fluentui/react-list-preview";
import { t } from "../i18n";
import CollectionTree from "./collection-tree";

export default function Browser() {
    return (
        <List className="flex flex-col gap-2 overflow-x-auto">
            <ListItem className="flex flex-col gap-1">
                <Text as="h3" size={200}>{t("browser.tagCollSectionTitle")}</Text>
                <CollectionTree />
            </ListItem>
        </List>
    )
}
