import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import Backend from "i18next-http-backend";
import { GetUserSettings } from "./backend";

const userSettings = await GetUserSettings()

i18n
    .use(Backend)
    .use(initReactI18next)
    .init({
        lng: userSettings["general"]["lng"] as string | undefined,
        supportedLngs: ["zh", "en"],
        fallbackLng: "en",
        debug: true,
    })

export default i18n
export const t = i18n.t
