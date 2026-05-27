import json

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

prt = data["countries"]["PRT"]
print("GP Years:", prt["gps"])

print("\n--- FDI (1980-2000) ---")
fdi = prt["indicators"]["FDI"]
for year in sorted(fdi.keys()):
    y = int(year)
    if 1980 <= y <= 2000:
        val = fdi[year]
        gp_str = " (GP)" if y in prt["gps"] else ""
        val_b = val / 1e9 if val else 0.0
        print(f"Year {year}: {val_b:.3f} Billion USD{gp_str}")

print("\n--- FDI (2018-2024) ---")
for year in sorted(fdi.keys()):
    y = int(year)
    if 2018 <= y <= 2024:
        val = fdi[year]
        gp_str = " (GP)" if y in prt["gps"] else ""
        val_b = val / 1e9 if val else 0.0
        print(f"Year {year}: {val_b:.3f} Billion USD{gp_str}")
