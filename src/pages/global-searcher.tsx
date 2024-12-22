import { CompoundButton, Input, Radio, RadioGroup, useToastController } from "@fluentui/react-components";
import { t } from "../i18n";
import { useContext, useEffect, useState } from "react";
import { AssetType, GetAssetsContainingTag, GlobalSearch, SearchQueryResult, SearchQueryTy } from "../backend";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/toasts/err-toast";
import { Cube20Regular, Image20Regular, Tag20Regular, Triangle20Regular } from "@fluentui/react-icons";
import FallbackableText from "../components/fallbackable-text";
import { browsingFolderContext, overlaysContext, selectedItemsContext } from "../helpers/context-provider";

export default function GlobalSearcher() {
    const [queryTy, setQueryTy] = useState<SearchQueryTy>("assetName")
    const [candidates, setCandidates] = useState<SearchQueryResult | undefined>()
    const [query, setQuery] = useState("")
    const [focusedItem, setFocusedItem] = useState<number | undefined>()

    const { dispatchToast } = useToastController(GlobalToasterId)

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const overlay = useContext(overlaysContext)

    useEffect(() => {
        async function fetch() {
            const result = await GlobalSearch({ ty: queryTy, query })
                .catch(err => dispatchToast(<ErrToast body={err} />))
            if (result) {
                setCandidates(result)
            }
        }
        fetch()
    }, [queryTy, query])

    const AssetIcon = ({ ty }: { ty: AssetType }) => {
        switch (ty) {
            case "rasterGraphics":
                return <Image20Regular />
            case "vectorGraphics":
                return <Triangle20Regular />
            case "gltfModel":
                return <Cube20Regular />
        }
    }

    const QueryResults = () => {
        if (!candidates) { return <></> }

        switch (candidates.ty) {
            case "assets":
                return candidates.data.map((asset, index) =>
                    <CompoundButton
                        key={index}
                        appearance="subtle"
                        icon={<AssetIcon ty={asset.ty} />}
                        secondaryContent={asset.id}
                        style={{
                            minHeight: "64px",
                            justifyContent: "start",
                        }}
                        onClick={() => {
                            browsingFolder?.setter({
                                id: undefined,
                                name: "",
                                content: [],
                                subTy: "tag",
                            })
                            selectedItems?.setter([{ id: asset.id, ty: "asset" }])
                            overlay?.setter(undefined)
                        }}
                    >
                        <FallbackableText
                            fallback={t("assetName.unnamed")}
                            text={asset.name}
                        />
                    </CompoundButton>
                )
            case "tags":
                return candidates.data.map((tag, index) =>
                    <CompoundButton
                        key={index}
                        appearance="subtle"
                        icon={<Tag20Regular />}
                        secondaryContent={tag.id}
                        style={{
                            minHeight: "64px",
                            justifyContent: "start",
                        }}
                        onClick={async () => {
                            const assets = await GetAssetsContainingTag({ tag: tag.id })
                                .catch(err => dispatchToast(<ErrToast body={err} />))

                            if (assets) {
                                browsingFolder?.setter({
                                    id: tag.id,
                                    name: tag.name,
                                    content: assets.map(a => { return { id: a, ty: "asset" } }),
                                    subTy: "tag",
                                })
                                overlay?.setter(undefined)
                            }
                        }}
                    >
                        <FallbackableText
                            fallback={t("tagName.unnamed")}
                            text={tag.name}
                            style={{ color: tag.color ? `#${tag.color}` : undefined }}
                        />
                    </CompoundButton>
                )
        }
    }

    return (
        <div className="w-3/5 h-3/5">
            <div
                className="p-4 rounded-md flex flex-col gap-2 h-full"
                style={{ backgroundColor: "var(--colorNeutralBackground1)" }}
            >
                <Input
                    autoFocus
                    appearance="underline"
                    onChange={(_, data) => {
                        if (focusedItem != undefined) {
                            setFocusedItem(undefined)
                        }
                        setQuery(data.value)
                    }}
                    style={{
                        width: "100%",
                        height: "60px",
                        fontSize: "30px",
                    }}
                    value={query}
                    onKeyDown={ev => {
                        if (ev.key == "Escape") {
                            overlay?.setter(undefined)
                        } else if (ev.key == "ArrowDown") {
                            setFocusedItem(0)
                        }
                    }}
                />
                <RadioGroup
                    className="flex justify-around"
                    defaultValue={queryTy}
                    layout="horizontal"
                    onChange={(_, data) => setQueryTy(data.value as SearchQueryTy)}
                >
                    <Radio value={"assetName"} label={t("globalSearch.item.assetName")} />
                    <Radio value={"tagName"} label={t("globalSearch.item.tagName")} />
                    <Radio value={"assetId"} label={t("globalSearch.item.assetId")} />
                    <Radio value={"tagId"} label={t("globalSearch.item.tagId")} />
                </RadioGroup>
                <div className="flex flex-col h-full overflow-y-auto">
                    <QueryResults />
                </div>
            </div>
        </div>
    )
}
