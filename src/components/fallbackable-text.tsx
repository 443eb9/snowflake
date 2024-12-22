import { Text, TextProps } from "@fluentui/react-components";

export default function FallbackableText({ fallback, text, ...props }: { fallback: string, text?: string | undefined } & TextProps) {
    return text?.length != 0
        ? <Text {...props}>
            {text}
        </Text>
        : <Text {...props} italic className={`opacity-50 ${props.className}`}>
            {fallback}
        </Text>
}
