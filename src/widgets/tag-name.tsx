import { Text } from "@fluentui/react-components"
import { t } from "../i18n"

export default function TagName({ name }: { name: string }) {
    if (!name) {
        return <></>
    }

    return name.length == 0
        ? <Text italic className="opacity-50">{t("tagName.fallback")}</Text>
        : <Text>{name}</Text>
}
