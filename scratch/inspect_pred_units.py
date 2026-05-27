import json

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

for code in ["PRT", "GBR", "ESP"]:
    if code in data["countries"]:
        cdata = data["countries"][code]
        print(f"\n--- {code} ---")
        if "predictions" in cdata and "xgboost" in cdata["predictions"]:
            xg = cdata["predictions"]["xgboost"]
            if "2026" in xg:
                for ind in ["GDP_growth", "FDI", "Tourism_arrivals"]:
                    if ind in xg["2026"]:
                        print(f"2026 {ind}:", xg["2026"][ind])
