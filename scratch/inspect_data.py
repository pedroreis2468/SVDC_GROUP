import json

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

print("Top level keys:", list(data.keys()))
countries = list(data["countries"].keys())
print("Number of countries:", len(countries))
print("Sample countries:", countries[:10])

# Inspect AZE data
if "AZE" in data["countries"]:
    aze = data["countries"]["AZE"]
    print("\nAZE keys:", list(aze.keys()))
    print("AZE indicators:", list(aze["indicators"].keys()))
    if "predictions" in aze:
        print("AZE predictions keys:", list(aze["predictions"].keys()))
        if "metrics" in aze["predictions"]:
            print("AZE predictions metrics:", list(aze["predictions"]["metrics"].keys()))
        # Print a sample prediction if exists
        for k in aze["predictions"].keys():
            if k != "metrics":
                print(f"Sample prediction for model '{k}':", list(aze["predictions"][k].keys()))
                year_sample = list(aze["predictions"][k].keys())[0]
                print(f"Prediction for year {year_sample}:", aze["predictions"][k][year_sample])
                break
