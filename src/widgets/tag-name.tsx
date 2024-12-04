import { Text } from "@fluentui/react-components"

export default function TagName({ name }: { name: string }) {
    if (!name) {
        return <></>
    }

    return name.length == 0
        ? <Text italic className="opacity-50">Unnamed</Text>
        : <Text>{name}</Text>
}
