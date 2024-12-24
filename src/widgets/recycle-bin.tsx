import { Button, useToastController } from "@fluentui/react-components";
import { BinRecycle20Regular } from "@fluentui/react-icons";
import { useContext, useEffect } from "react";
import { browsingFolderContext } from "../helpers/context-provider";
import { isAtRecycleBin } from "../util";
import { GetRecycleBin, IdTy } from "../backend";
import { GlobalToasterId } from "../main";
import ErrToast from "./toasts/err-toast";
import { t } from "../i18n";

export default function RecycleBin() {
    const browsingFolder = useContext(browsingFolderContext)

    const { dispatchToast } = useToastController(GlobalToasterId)

    useEffect(() => {
        async function fetch() {
            if (!browsingFolder?.data || !isAtRecycleBin(browsingFolder?.data?.subTy)) { return }

            let ty: IdTy | undefined;
            switch (browsingFolder.data.subTy) {
                case "recycleBinAssets": ty = "asset"; break
                case "recycleBinCollections": ty = "collection"; break
                case "recycleBinTags": ty = "tag"; break
            }
            if (!ty) { return }

            const recycleBin = await GetRecycleBin({ ty })
                .catch(err => dispatchToast(<ErrToast body={err} />, { intent: "error" }))
            if (recycleBin) {
                browsingFolder?.setter({
                    id: undefined,
                    name: t("recycleBin.title"),
                    content: recycleBin.ids.map(id => { return { id, ty: recycleBin.ty } }),
                    subTy: browsingFolder.data.subTy,
                })
            }
        }

        fetch()
    }, [browsingFolder?.data?.subTy])

    return (
        <Button
            appearance="outline"
            icon={<BinRecycle20Regular />}
            onClick={async () => {
                browsingFolder?.setter({
                    id: undefined,
                    name: "",
                    content: [],
                    subTy: "recycleBinAssets",
                })
            }}
        />
    )
}
