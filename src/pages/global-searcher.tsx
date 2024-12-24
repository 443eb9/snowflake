import { Button, CompoundButton, Input, Radio, RadioGroup, Text, useToastController } from "@fluentui/react-components";
import { t } from "../i18n";
import { useContext, useEffect, useState } from "react";
import { AssetType, GetAllUncategorizedAssets, GetAssetsContainingTag, GetTagsOnAsset, GetTagVirtualPath, GlobalSearch, SearchQueryResult, SearchQueryTy } from "../backend";
import { GlobalToasterId } from "../main";
import ErrToast from "../widgets/toasts/err-toast";
import { Cube20Regular, Image20Regular, Tag20Regular, Triangle20Regular } from "@fluentui/react-icons";
import FallbackableText from "../components/fallbackable-text";
import { browsingFolderContext, overlaysContext, selectedItemsContext } from "../helpers/context-provider";

export default function GlobalSearcher() {
    const [queryTy, setQueryTy] = useState<SearchQueryTy>("assetName")
    const [candidates, setCandidates] = useState<SearchQueryResult | undefined>()
    const [query, setQuery] = useState("")

    const { dispatchToast } = useToastController(GlobalToasterId)

    const browsingFolder = useContext(browsingFolderContext)
    const selectedItems = useContext(selectedItemsContext)
    const overlay = useContext(overlaysContext)

    useEffect(() => {
        async function fetch() {
            const result = await GlobalSearch({ ty: queryTy, query })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
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
        const [tagsVirtualPath, setTagsVirtualPath] = useState<(void | string[])[] | undefined>()

        useEffect(() => {
            if (candidates?.ty != "tags") { return }

            async function fetch() {
                if (!candidates?.data) { return }

                setTagsVirtualPath(await Promise.all(candidates.data
                    .map(async tag =>
                        await GetTagVirtualPath({ tag: tag.id })
                            .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                    )))
            }

            fetch()
        }, [candidates])

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
                        onClick={async () => {
                            const tags = await GetTagsOnAsset({ asset: asset.id })
                                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
                            if (tags) {
                                if (tags.length == 0) {
                                    const assets = await GetAllUncategorizedAssets()
                                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

                                    if (assets) {
                                        browsingFolder?.setter({
                                            id: undefined,
                                            name: "",
                                            content: assets.map(a => { return { id: a, ty: "asset" } }),
                                            subTy: "uncategorized",
                                        })
                                    }
                                } else if (tags.length == 1) {
                                    const assets = await GetAssetsContainingTag({ tag: tags[0] })
                                        .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

                                    if (assets) {
                                        browsingFolder?.setter({
                                            id: tags[0],
                                            name: "",
                                            content: assets.map(a => { return { id: a, ty: "asset" } }),
                                            subTy: "tag",
                                        })
                                    }
                                }

                                selectedItems?.setter([{ id: asset.id, ty: "asset" }])
                                overlay?.setter(undefined)
                            }
                        }}
                    >
                        <FallbackableText
                            fallback={t("assetName.unnamed")}
                            text={asset.name}
                        />
                    </CompoundButton>
                )
            case "tags":
                if (!tagsVirtualPath) { return <></> }

                return candidates.data.map((tag, index) =>
                    <Button
                        key={index}
                        appearance="subtle"
                        icon={<Tag20Regular />}
                        style={{
                            minHeight: "64px",
                            justifyContent: "start",
                        }}
                        onClick={async () => {
                            const assets = await GetAssetsContainingTag({ tag: tag.id })
                                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))

                            if (assets) {
                                browsingFolder?.setter({
                                    id: tag.id,
                                    name: tag.name,
                                    content: assets.map(a => { return { id: a, ty: "asset" } }),
                                    subTy: "tag",
                                })
                                selectedItems?.setter([])
                                overlay?.setter(undefined)
                            }
                        }}
                    >
                        <div className="flex justify-between w-full items-center pl-2">
                            <div className="flex flex-col gap-1">
                                <FallbackableText
                                    fallback={t("tagName.unnamed")}
                                    text={tag.name}
                                    style={{ color: tag.color ? `#${tag.color}` : undefined }}
                                />
                                <Text size={200}>{tag.id}</Text>
                            </div>
                            <div className="flex gap-1">
                                {
                                    tagsVirtualPath[index]?.map((collection, collectionIndex) =>
                                        <>
                                            <FallbackableText
                                                key={collectionIndex * 2}
                                                fallback={t("collectionName.unnamed")}
                                                text={collection}
                                                size={200}
                                            />
                                            <Text key={collectionIndex * 2 + 1} size={200}>/</Text>
                                        </>
                                    )
                                }
                            </div>
                        </div>
                    </Button>
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
                    onChange={(_, data) => setQuery(data.value)}
                    style={{
                        width: "100%",
                        height: "60px",
                        fontSize: "30px",
                    }}
                    value={query}
                    onKeyDown={ev => {
                        if (ev.key == "Escape") {
                            overlay?.setter(undefined)
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
