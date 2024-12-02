import { Button, createTableColumn, DataGrid, DataGridBody, DataGridCell, DataGridHeader, DataGridHeaderCell, DataGridRow, Input, makeStyles, Popover, PopoverSurface, PopoverTrigger, TableCellLayout, TableColumnDefinition, Text } from "@fluentui/react-components";
import { Checkmark20Regular, Color20Regular, Edit20Regular, Tag20Regular } from "@fluentui/react-icons";
import { useCallback, useEffect, useState } from "react";
import { main } from "../../wailsjs/go/models";
import { GetAllTags, ModifyTag } from "../../wailsjs/go/main/App";
import { v4 } from "uuid";
import randomColor from "randomcolor";

type TagEditingStatus = {
    isEditingName: boolean,
    isEditingColor: boolean,
}

type EditableTagRef = main.TagRef & TagEditingStatus

const inputStyleHook = makeStyles({
    root: {
        maxWidth: "150px"
    },
})

export default function TagsManager() {
    const [allTags, setAllTags] = useState<EditableTagRef[] | undefined>()
    const [refresh, setRefresh] = useState(true)
    const inputStyle = inputStyleHook()
    const updateTag = useCallback(async (tag: main.TagRef) => {
        await ModifyTag(tag)
            .catch(err => {
                // TODO error handling
                console.error(err)
            })
    }, [])

    useEffect(() => {
        if (allTags) { return }
        async function fetch() {
            const allTags = await GetAllTags()
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
            if (allTags) {
                setAllTags(allTags.map(tag => {
                    return {
                        isEditingName: false,
                        isEditingColor: false,
                        ...tag
                    }
                }))
            }
        }

        fetch()
    }, [])

    const refreshPage = () => {
        setRefresh(!refresh)
    }

    if (!allTags) {
        return <></>
    }

    return (
        <Popover inline>
            <PopoverTrigger>
                <Button icon={<Tag20Regular />}></Button>
            </PopoverTrigger>

            <PopoverSurface className="flex flex-col gap-2 w-1/2">
                <Text>Tags Management</Text>
                {
                    allTags.length == 0
                        ? <Text italic className="opacity-50">Void</Text>
                        : <DataGrid
                            className="max-h-96 overflow-y-auto"
                            items={allTags}
                            columns={generateColumns(refreshPage, inputStyle, updateTag)}
                        >
                            <DataGridHeader>
                                <DataGridRow>
                                    {
                                        ({ renderHeaderCell }) =>
                                            <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                                    }
                                </DataGridRow>
                            </DataGridHeader>
                            <DataGridBody<main.TagRef>>
                                {
                                    ({ item, rowId }) =>
                                        <DataGridRow<main.TagRef> key={rowId}>
                                            {({ renderCell }) =>
                                                <DataGridCell>{renderCell(item)}</DataGridCell>
                                            }
                                        </DataGridRow>
                                }
                            </DataGridBody>
                        </DataGrid>
                }
                <Button
                    onClick={() => {
                        setAllTags([
                            ...allTags,
                            {
                                id: v4(),
                                name: "",
                                color: randomColor().substring(1),
                                isEditingName: true,
                                isEditingColor: false,
                            },
                        ])
                    }}
                >Add Tag</Button>
            </PopoverSurface>
        </Popover>
    )
}

function generateColumns(refresh: () => void, inputStyle: any, updateTag: any): TableColumnDefinition<EditableTagRef>[] {
    return [
        createTableColumn<EditableTagRef>({
            columnId: "name",
            compare: (a, b) => a.name.localeCompare(b.name),
            renderHeaderCell: () => "Name",
            renderCell: item =>
                <TableCellLayout>
                    {
                        item.isEditingName
                            ? <Input
                                defaultValue={item.name}
                                onChange={(_, data) => {
                                    item.name = data.value
                                }}
                                className={inputStyle.root}
                            />
                            : item.name
                    }
                </TableCellLayout>
        }),
        createTableColumn<EditableTagRef>({
            columnId: "color",
            compare: (a, b) => a.color.localeCompare(b.color),
            renderHeaderCell: () => "Color",
            renderCell: item =>
                <TableCellLayout style={{ color: `#${item.color}` }}>
                    {item.color}
                </TableCellLayout>
        }),
        createTableColumn<EditableTagRef>({
            columnId: "actions",
            compare: _ => 0,
            renderHeaderCell: () => "Actions",
            renderCell: item =>
                <TableCellLayout>
                    <div className="flex gap-2">
                        <Button
                            icon={<Edit20Regular />}
                            onClick={() => {
                                item.isEditingName = true
                                item.isEditingColor = false
                                refresh()
                            }}
                        />
                        <Button
                            icon={<Color20Regular />}
                        // TODO color picking
                        // onClick={() => {
                        //     item.isEditingName = false
                        //     item.isEditingColor = true
                        //     refresh()
                        // }}
                        />
                        {
                            (item.isEditingName || item.isEditingColor) &&
                            <Button
                                icon={
                                    <Checkmark20Regular
                                        onClick={() => {
                                            item.isEditingName = false
                                            item.isEditingColor = false
                                            updateTag(item)
                                            refresh()
                                        }}
                                    />
                                }
                            />
                        }
                    </div>
                </TableCellLayout>
        }),
    ]
}
