import { Button, createTableColumn, DataGrid, DataGridBody, DataGridCell, DataGridHeader, DataGridHeaderCell, DataGridRow, Input, makeStyles, Popover, PopoverSurface, PopoverTrigger, TableCellLayout, TableColumnDefinition, Text } from "@fluentui/react-components";
import { Checkmark20Regular, Color20Regular, Edit20Regular, Tag20Regular } from "@fluentui/react-icons";
import { useCallback, useContext, useEffect, useState } from "react";
import { v4 } from "uuid";
import randomColor from "randomcolor";
import { GetAllTags, ModifyTag, Tag } from "../backend";
import { allTagsContext } from "../context-provider";

type TagEditingStatus = {
    isEditingName: boolean,
    isEditingColor: boolean,
}

type EditableTag = Tag & TagEditingStatus

const inputStyleHook = makeStyles({
    root: {
        maxWidth: "150px"
    },
})

export default function TagsManager() {
    const allTags = useContext(allTagsContext)

    const [allTagsEditable, setAllTagsEditable] = useState<EditableTag[] | undefined>()
    const [refresh, setRefresh] = useState(true)
    const inputStyle = inputStyleHook()
    const updateTag = useCallback(async (tag: Tag) => {
        await ModifyTag({ newTag: tag })
            .catch(err => {
                // TODO error handling
                console.error(err)
            })
        fetchTags()
    }, [])

    async function fetchTags() {
        const fetchedTags = await GetAllTags()
            .catch(err => {
                // TODO error handling
                console.error(err)
            })

        if (fetchedTags) {
            setAllTagsEditable(fetchedTags.map(tag => {
                return {
                    isEditingName: false,
                    isEditingColor: false,
                    ...tag
                }
            }))
            allTags?.setter(fetchedTags)
        }
    }

    useEffect(() => {
        if (allTagsEditable) { return }

        fetchTags()
    }, [])

    const refreshPage = () => {
        setRefresh(!refresh)
    }

    if (!allTagsEditable) {
        return <></>
    }

    return (
        <div>
            <Popover inline>
                <PopoverTrigger>
                    <Button icon={<Tag20Regular />}></Button>
                </PopoverTrigger>

                <PopoverSurface className="flex flex-col gap-2 w-1/2">
                    <Text>Tags Management</Text>
                    {
                        allTagsEditable.length == 0
                            ? <Text italic className="opacity-50">Void</Text>
                            : <DataGrid
                                className="max-h-96 overflow-y-auto"
                                items={allTagsEditable}
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
                                <DataGridBody<Tag>>
                                    {
                                        ({ item, rowId }) =>
                                            <DataGridRow<Tag> key={rowId}>
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
                            setAllTagsEditable([
                                ...allTagsEditable,
                                {
                                    name: "",
                                    color: randomColor().substring(1),
                                    meta: {
                                        id: v4(),
                                        created_at: new Date(),
                                        last_modified: new Date(),
                                    },
                                    isEditingName: true,
                                    isEditingColor: false,
                                }
                            ])
                        }}
                    >Add Tag</Button>
                </PopoverSurface>
            </Popover>
        </div>
    )
}

function generateColumns(refresh: () => void, inputStyle: any, updateTag: any): TableColumnDefinition<EditableTag>[] {
    return [
        createTableColumn<EditableTag>({
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
        createTableColumn<EditableTag>({
            columnId: "color",
            compare: (a, b) => a.color.localeCompare(b.color),
            renderHeaderCell: () => "Color",
            renderCell: item =>
                <TableCellLayout style={{ color: `#${item.color}` }}>
                    {item.color}
                </TableCellLayout>
        }),
        createTableColumn<EditableTag>({
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
