import { Text } from "@fluentui/react-components";
import { DuplicateAssets } from "../backend";

export default function DuplicationList({ list }: { list: DuplicateAssets }) {
    return (
        <div className="flex flex-col max-h-96 overflow-y-auto gap-2">
            {
                Object.entries(list).map(([crc, ids], index) =>
                    <div key={index} className="flex flex-col">
                        <Text className="">[CRC]{crc}</Text>
                        {
                            ids.map(id =>
                                <Text key={id} className="">
                                    {id}
                                </Text>
                            )
                        }
                    </div>
                )
            }
        </div>
    )
}
