import { Button, createTableColumn, DataGrid, DataGridBody, DataGridCell, DataGridHeader, DataGridHeaderCell, DataGridRow, TableCellLayout, TableColumnDefinition, Text, Title1, Title2, useToastController } from "@fluentui/react-components";
import { t } from "../i18n";
import { useNavigate } from "react-router-dom";
import { ArrowExit20Regular } from "@fluentui/react-icons";
import { GetLibraryMeta, GetLibraryStatistics, LibraryMeta, LibraryStatistics } from "../backend";
import { useEffect, useState } from "react";
import ErrToast from "../widgets/err-toast";
import { GlobalToasterId } from "../main";
import WindowControls from "../widgets/window-controls";

type StatProp = {
    name: string,
    value: string,
}

type ExtStat = [string, number]

export default function LibStatistics() {
    const [libraryMeta, setLibraryMeta] = useState<LibraryMeta>()
    const [libraryStatistics, setLibraryStatistics] = useState<LibraryStatistics>()

    const nav = useNavigate()
    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            const libraryMeta = await GetLibraryMeta()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (libraryMeta) {
                setLibraryMeta(libraryMeta)
            }

            const libraryStatistics = await GetLibraryStatistics()
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

            if (libraryStatistics) {
                setLibraryStatistics(libraryStatistics)
            }
        }

        fetch()
    }, [])

    return (
        <>
            <div className="absolute right-2 top-2" style={{ width: "calc(100% - 100px)" }}>
                <WindowControls />
            </div>
            <div className="flex flex-col p-4 gap-2">
                <div className="flex gap-2 items-center">
                    <Button icon={<ArrowExit20Regular />} onClick={() => nav(-1)} />
                    <Title1>{t("stat.title")}</Title1>
                </div>
                {
                    libraryMeta && libraryStatistics
                        ? <div className="flex flex-col gap-4">
                            <DataGrid
                                items={genetateProps(libraryStatistics)}
                                columns={generatePropColumns()}
                            >
                                <DataGridHeader>
                                    <DataGridRow >
                                        {
                                            ({ renderHeaderCell }) => (
                                                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                                            )
                                        }
                                    </DataGridRow>
                                </DataGridHeader>
                                <DataGridBody<StatProp>>
                                    {
                                        ({ item, rowId }) => (
                                            <DataGridRow<StatProp> key={rowId}>
                                                {({ renderCell }) => (
                                                    <DataGridCell>{renderCell(item)}</DataGridCell>
                                                )}
                                            </DataGridRow>
                                        )
                                    }
                                </DataGridBody>
                            </DataGrid>
                            <DataGrid
                                items={Object.entries(libraryStatistics.assetExt).sort()}
                                columns={generateExtColumns()}
                            >
                                <DataGridHeader>
                                    <DataGridRow >
                                        {
                                            ({ renderHeaderCell }) => (
                                                <DataGridHeaderCell>{renderHeaderCell()}</DataGridHeaderCell>
                                            )
                                        }
                                    </DataGridRow>
                                </DataGridHeader>
                                <DataGridBody<ExtStat>>
                                    {
                                        ({ item, rowId }) => (
                                            <DataGridRow<ExtStat> key={rowId}>
                                                {({ renderCell }) => (
                                                    <DataGridCell>{renderCell(item)}</DataGridCell>
                                                )}
                                            </DataGridRow>
                                        )
                                    }
                                </DataGridBody>
                            </DataGrid>
                        </div>
                        : <Title2>{t("stat.computing")}</Title2>
                }
            </div>
        </>
    )
}

function genetateProps(stat: LibraryStatistics) {
    return [
        {
            name: t("stat.props.totalAssets"),
            value: stat.totalAssets,
        }
    ]
}

function generateExtColumns(): TableColumnDefinition<ExtStat>[] {
    return [
        createTableColumn<ExtStat>({
            columnId: "properties",
            compare: (a, b) => a[0].localeCompare(b[0]),
            renderHeaderCell: () => t("stat.ext.title"),
            renderCell: item =>
                <TableCellLayout>
                    <Text font="monospace">{item[0]}</Text>
                </TableCellLayout>
        }),
        createTableColumn<ExtStat>({
            columnId: "values",
            compare: (a, b) => a[0].localeCompare(b[0]),
            renderHeaderCell: () => t("stat.ext.cnt"),
            renderCell: item =>
                <TableCellLayout>
                    <Text>{item[1]}</Text>
                </TableCellLayout>
        })
    ]
}

function generatePropColumns(): TableColumnDefinition<StatProp>[] {
    return [
        createTableColumn<StatProp>({
            columnId: "properties",
            compare: (a, b) => a.name.localeCompare(b.name),
            renderHeaderCell: () => t("stat.props.title"),
            renderCell: item =>
                <TableCellLayout>
                    <Text>{item.name}</Text>
                </TableCellLayout>
        }),
        createTableColumn<StatProp>({
            columnId: "values",
            compare: (a, b) => a.name.localeCompare(b.name),
            renderHeaderCell: () => t("stat.props.value"),
            renderCell: item =>
                <TableCellLayout>
                    <Text>{item.value}</Text>
                </TableCellLayout>
        })
    ]
}
