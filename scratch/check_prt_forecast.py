import json

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

prt = data["countries"]["PRT"]
pred = prt["predictions"]["xgboost"]
print("XGBoost predictions for PRT:")
for year in ["2026"]:
    print(f"\nYear {year}:")
    for ind in ["Tourism_arrivals"]:
        pdata = pred[year].get(ind)
        if pdata:
            print(f"  {ind} keys:", list(pdata.keys()))
            for k, v in pdata.items():
                print(f"    {k}: {v}")
