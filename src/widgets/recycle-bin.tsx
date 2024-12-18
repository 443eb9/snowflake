import { Button, useToastController } from "@fluentui/react-components";
import { BinRecycle20Regular } from "@fluentui/react-icons";
import { useContext } from "react";
import { browsingFolderContext } from "../helpers/context-provider";
import { GetRecycleBin } from "../backend";
import ErrToast from "./toasts/err-toast";
import { t } from "../i18n";
import { decodeItem } from "../util";

export default function RecycleBin() {
    const browsingFolder = useContext(browsingFolderContext)
    const { dispatchToast } = useToastController()

    return (
        <Button
            appearance="outline"
            icon={<BinRecycle20Regular />}
            onClick={async () => {
                const recycleBin = await GetRecycleBin()
                    .catch(err => dispatchToast(<ErrToast body={err} />))

                if (recycleBin) {
                    browsingFolder?.setter({
                        id: undefined,
                        name: t("recycleBin.title"),
                        content: recycleBin.map(obj => {
                            const decoded = decodeItem(obj)
                            console.log(obj, { id: decoded.id, ty: decoded.ty })
                            return { id: decoded.id, ty: decoded.ty }
                        }),
                        subTy: "recycleBin",
                    })
                }
            }}
        />
    )
}