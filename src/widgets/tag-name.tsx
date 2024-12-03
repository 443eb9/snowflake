import { Text } from "@fluentui/react-components"

export default function TagName({ name }: { name: string }) {
    return name.length == 0
        ? <Text italic className="opacity-50">Unnamed</Text>
        : <Text wrap>{name}</Text>
}
