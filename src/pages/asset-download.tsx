import { Button, Input, makeStyles, Text } from "@fluentui/react-components";
import { Add20Regular, ArrowDownload20Regular } from "@fluentui/react-icons";
import { List, ListItem } from "@fluentui/react-list-preview";
import { useContext, useEffect, useState } from "react";
import { DownloadEvent, GetFolder, ImportWebAssets } from "../backend";
import { browsingFolderContext, fileManipulationContext } from "../context-provider";
import { Channel } from "@tauri-apps/api/core";
import formatFileSize from "../util";

const eventTextStyleHook = makeStyles({
    root: {
        width: "100%",
        textAlign: "right",
        paddingRight: "15px",
    }
})

export default function AssetDownload({ lockOverlay }: { lockOverlay: (lock: boolean) => void }) {
    const browsingFolder = useContext(browsingFolderContext)
    const fileManipulation = useContext(fileManipulationContext)

    const [urls, setUrls] = useState<string[]>([""])
    const [status, setStatus] = useState<(DownloadEvent | undefined)[]>([])
    const eventTextStyle = eventTextStyleHook()
    const [statusMapper, _] = useState(new Map<number, DownloadEvent>())

    const progress = new Channel<DownloadEvent>()
    progress.onmessage = (resp: DownloadEvent) => {
        statusMapper.set(resp.id, resp)
        setStatus(Array.from(statusMapper.values()).sort(x => x.id))
    }

    const startDownload = async () => {
        if (browsingFolder?.data?.id) {
            statusMapper.clear()
            await ImportWebAssets({ urls, parent: browsingFolder.data.id, progress })
                .catch(err => {
                    // TODO error handling
                    console.error(err)
                })
        }
    }

    function EventDisplay({ ev }: { ev: DownloadEvent }) {
        const parse = () => {
            console.log(ev)
            switch (ev.status) {
                case "SendingGet":
                    return ["Sending GET", "colorPaletteYellowBackground2", 1]
                case "Started":
                    return ["Start!", "colorPaletteLightGreenBackground2", 0]
                case "Ongoing":
                    const total = ev.total == undefined ? "unknown" : formatFileSize(ev.total)
                    const progress = ev.total == undefined ? 0 : ev.downloaded / ev.total
                    return [`${formatFileSize(ev.downloaded)}/${total}`, "colorPaletteLightGreenBackground2", progress]
                case "Finished":
                    return ["Done!", "colorPaletteGreenBackground2", 1]
                default:
                    return [`Error: ${(ev.status as any).Error}`, "colorPaletteRedBackground2", 1]
            }
        }

        const [text, color, progress] = parse()

        return (
            <>
                <div
                    className="h-full absolute opacity-20"
                    style={{
                        width: `${progress as number * 100}%`,
                        backgroundColor: `var(--${color})`
                    }}
                />
                <Text className={eventTextStyle.root} size={400} font="monospace">
                    {text}
                </Text>
            </>
        )
    }

    const downloading = statusMapper.size == 0 ? -1 : status.filter(x => x?.status != "Finished" && typeof x == "string").length
    const finished = statusMapper.size == 0 ? -1 : status?.filter(s => s?.status == "Finished").length

    useEffect(() => {
        async function update() {
            if (browsingFolder?.data?.id) {
                const folder = await GetFolder({ folder: browsingFolder?.data?.id })
                    .catch(err => {
                        // TODO error handling
                        console.error(err)
                    })
                if (folder) {
                    browsingFolder.setter({
                        ...folder,
                        collection: false,
                    })

                    // Trick to make folder tree update
                    // This makes no sense for real manipulation
                    fileManipulation?.setter({
                        id: [],
                        ty: "create",
                        id_ty: "assets",
                        submit: undefined,
                    })
                }
            }
        }

        if (downloading > 0) {
            lockOverlay(true)
        } else {
            lockOverlay(false)
            update()
        }
    }, [status])

    return (
        <div className="flex flex-col gap-2 h-full">
            <Text size={600} weight="bold">Download asset from URLs</Text>
            <div className="flex flex-grow flex-col h-full overflow-y-auto">
                <List className="flex flex-col gap-2">
                    {
                        urls.map((url, index) =>
                            <ListItem key={index} className="relative flex gap-4">
                                <Input
                                    disabled={downloading != -1}
                                    style={{ width: "100%" }}
                                    size="large"
                                    value={url}
                                    onChange={ev => {
                                        setUrls(urls.map((d, i) => i == index ? ev.target.value : d))
                                    }}
                                />
                                {
                                    status && status[index] &&
                                    <div className="w-full h-full absolute flex items-center">
                                        <EventDisplay ev={status[index]} />
                                    </div>
                                }
                            </ListItem>
                        )
                    }
                </List>
            </div>
            {
                downloading == -1 &&
                <div className="flex justify-around">
                    <Button
                        icon={<Add20Regular />}
                        size="large"
                        className="w-[30%]"
                        onClick={() => { setUrls([...urls, ""]) }}
                    >
                        Add
                    </Button>
                    <Button
                        icon={<ArrowDownload20Regular />}
                        size="large"
                        className="w-[30%]"
                        onClick={startDownload}
                    >
                        Start
                    </Button>
                </div>
            }
        </div>
    )
}