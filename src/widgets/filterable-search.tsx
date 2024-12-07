import { Input, makeStyles } from "@fluentui/react-components";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Item, ItemProps } from "react-contexify";

const inputStyleHook = makeStyles({
    root: {
        "width": "100%",
        "padding": "4px",
    }
})

export default function FilterableSearch<T>({
    range, searchKey, component, noMatch, itemProps, focused
}: {
    range: T[],
    searchKey: (item: T) => string,
    component: (item: T) => ReactNode,
    noMatch: ReactNode,
    itemProps?: (item: T) => Omit<ItemProps, "children">,
    focused: () => boolean,
}) {
    const [filter, setFilter] = useState("")
    const inputRef = useRef<HTMLInputElement>(null)

    const inputStyle = inputStyleHook()

    useEffect(() => {
        if (focused()) {
            inputRef.current?.focus()
        }
    }, [focused()])

    const standardizedFilter = filter.toLowerCase()
    const filteredResults = range.filter(x => searchKey(x).toLowerCase().includes(standardizedFilter))

    return (
        <>
            <Input
                className={inputStyle.root}
                appearance="underline"
                onChange={ev => setFilter(ev.target.value)}
                ref={inputRef}
            />
            <div className="max-h-[300px] overflow-auto mt-1">
                {
                    !filteredResults || filteredResults?.length == 0
                        ? <Item>
                            {noMatch}
                        </Item>
                        : filteredResults.map((x, index) =>
                            <Item key={index} {...itemProps?.(x)}>
                                {component(x)}
                            </Item>
                        )
                }
            </div>
        </>
    )
}
