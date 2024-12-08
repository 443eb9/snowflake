import { Button, Input, makeStyles, Text, Title2, useToastController } from "@fluentui/react-components";
import { Add20Regular, ArrowDownload20Regular } from "@fluentui/react-icons";
import { List, ListItem } from "@fluentui/react-list-preview";
import { useContext, useEffect, useState } from "react";
import { DownloadEvent, GetFolder, ImportWebAssets } from "../backend";
import { browsingFolderContext } from "../helpers/context-provider";
import { Channel } from "@tauri-apps/api/core";
import formatFileSize from "../util";
import { t } from "i18next";
import ErrToast from "../widgets/err-toast";
import { GlobalToasterId } from "../main";

const eventTextStyleHook = makeStyles({
    root: {
        width: "100%",
        textAlign: "right",
        paddingRight: "15px",
    }
})

export default function AssetDownload({ lockOverlay }: { lockOverlay: (lock: boolean) => void }) {
    const browsingFolder = useContext(browsingFolderContext)

    const [urls, setUrls] = useState<string[]>([""])
    const [status, setStatus] = useState<(DownloadEvent | undefined)[]>([])
    const eventTextStyle = eventTextStyleHook()
    const [statusMapper, _] = useState(new Map<number, DownloadEvent>())

    const { dispatchToast } = useToastController(GlobalToasterId)

    const progress = new Channel<DownloadEvent>()
    progress.onmessage = (resp: DownloadEvent) => {
        statusMapper.set(resp.id, resp)
        setStatus(Array.from(statusMapper.values()).sort(x => x.id))
    }

    const startDownload = async () => {
        if (browsingFolder?.data?.id) {
            statusMapper.clear()
            await ImportWebAssets({ urls, parent: browsingFolder.data.id, progress })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
        }
    }

    function EventDisplay({ ev }: { ev: DownloadEvent }) {
        const parse = () => {
            switch (ev.status) {
                case "SendingGet":
                    return [t("asset-download.sendingGet"), "colorPaletteYellowBackground2", 1]
                case "Started":
                    return [t("asset-download.start"), "colorPaletteLightGreenBackground2", 0]
                case "Ongoing":
                    const total = ev.total == undefined ? "unknown" : formatFileSize(ev.total)
                    const progress = ev.total == undefined ? 0 : ev.downloaded / ev.total
                    return [`${formatFileSize(ev.downloaded)}/${total}`, "colorPaletteLightGreenBackground2", progress]
                case "Finished":
                    return [t("asset-download.done"), "colorPaletteGreenBackground2", 1]
                default:
                    return [`${t("asset-download.error")}: ${(ev.status as any).Error}`, "colorPaletteRedBackground2", 1]
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

    const downloading = statusMapper.size == 0 ? -1 : status.filter(x => x?.status != "Finished" && typeof x?.status == "string").length
    const finished = statusMapper.size == 0 ? -1 : status?.filter(s => s?.status == "Finished").length

    useEffect(() => {
        async function update() {
            if (browsingFolder?.data?.id) {
                const folder = await GetFolder({ folder: browsingFolder?.data?.id })
                    .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                if (folder) {
                    browsingFolder.setter({
                        ...folder,
                        collection: false,
                    })
                }
            }
        }

        if (downloading > 0 && finished != urls.length) {
            lockOverlay(true)
        } else if (downloading != -1) {
            lockOverlay(false)
            update()
        }
    }, [status])

    return (
        <div className="flex flex-col gap-2 h-full">
            <Title2>{t("asset-download.title")}</Title2>
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
                                    autoFocus
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
                        {t("asset-download.add")}
                    </Button>
                    <Button
                        icon={<ArrowDownload20Regular />}
                        size="large"
                        className="w-[30%]"
                        onClick={startDownload}
                    >
                        {t("asset-download.start")}
                    </Button>
                </div>
            }
        </div>
    )
}
