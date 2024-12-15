import json
import os

locales_dir = "public/locales"
translation_json = "translation.json"

en_lng: dict[str, str] = json.load(
    open(os.path.join(locales_dir, "en", translation_json), encoding="UTF-8")
)
json.dump(
    dict(sorted(en_lng.items())),
    open(os.path.join(locales_dir, "en", translation_json), "w", encoding="UTF-8"),
    ensure_ascii=False,
    indent=4,
)

other_lngs: dict[str, dict[str, str]] = {}
locales = os.listdir(locales_dir)
for lng in locales:
    if lng == "en":
        continue
    path = os.path.join(locales_dir, lng, translation_json)
    data = json.load(open(path, encoding="UTF-8"))
    other_lngs[lng] = data

en_set = set(en_lng.keys())

for lng, data in other_lngs.items():
    other_set = set(data.keys())
    missing = en_set - other_set
    redundant = other_set - en_set

    for key in missing:
        data[key] = en_lng[key]
    for key in redundant:
        data.pop(key)

    json.dump(
        dict(sorted(data.items())),
        open(os.path.join(locales_dir, lng, translation_json), "w", encoding="UTF-8"),
        ensure_ascii=False,
        indent=4,
    )
