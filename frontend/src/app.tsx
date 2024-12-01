import AssetsGrid from "./assets-grid";
import Browser from "./browser";
import DetailInfo from "./detail-info";

export default function MainApp() {
    return (
        <div className="p-8">
            <Browser></Browser>
            <AssetsGrid></AssetsGrid>
            <DetailInfo></DetailInfo>
        </div>
    )
}
