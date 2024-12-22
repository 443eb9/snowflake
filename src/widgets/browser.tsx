import { Text } from "@fluentui/react-components";
import { t } from "../i18n";
import CollectionTree from "./collection-tree";

export default function Browser() {
    return (
        <div className="flex flex-col gap-2 h-full">
            <Text as="h3" size={200}>{t("browser.tagCollSectionTitle")}</Text>
            <CollectionTree />
        </div>
    )
}
