import { Text } from "@fluentui/react-components";
import { FolderTree } from "../widgets/folder-tree";
import TagsCollections from "../widgets/tags-collections";
import { List, ListItem } from "@fluentui/react-list-preview";
import { t } from "../i18n";

export default function Browser() {
    return (
        <List className="flex flex-col gap-2 overflow-x-auto">
            <ListItem className="flex flex-col gap-1">
                <Text as="h3" size={200}>{t("browser.folderTreeSectionTitle")}</Text>
                <FolderTree />
            </ListItem>
            <ListItem className="flex flex-col gap-1">
                <Text as="h3" size={200}>{t("browser.tagCollSectionTitle")}</Text>
                <TagsCollections />
            </ListItem>
        </List>
    )
}
