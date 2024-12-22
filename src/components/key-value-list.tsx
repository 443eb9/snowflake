import { Text, TextProps } from "@fluentui/react-components";
import { ReactNode } from "react";

export type KeyValueListItem = {
    key: ReactNode,
    keyProps?: TextProps,
    value: ReactNode,
    valueProps?: TextProps,
    vertical?: boolean,
}

export default function KeyValueList({ items }: { items: KeyValueListItem[] }) {
    return (
        <div className="flex flex-col gap-4">
            {
                items.map((item, index) =>
                    <div key={index} className={`flex ${item.vertical ? "flex-col gap-1" : "justify-between"}`}>
                        <Text {...item.keyProps}>{item.key}</Text>
                        <Text {...item.valueProps}>{item.value}</Text>
                    </div>
                )
            }
        </div>
    )
}
