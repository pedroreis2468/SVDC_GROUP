import json

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

aze = data["countries"]["AZE"]
print("GP Years:", aze["gps"])

print("\n--- FDI ---")
fdi = aze["indicators"]["FDI"]
for year in sorted(fdi.keys()):
    y = int(year)
    if y >= 2010:
        val = fdi[year]
        gp_str = " (GP)" if y in aze["gps"] else ""
        val_b = val / 1e9 if val else 0.0
        print(f"Year {year}: {val_b:.3f} Billion USD{gp_str}")

print("\n--- Tourism Arrivals ---")
tour = aze["indicators"]["Tourism_arrivals"]
for year in sorted(tour.keys()):
    y = int(year)
    if y >= 2010:
        val = tour[year]
        gp_str = " (GP)" if y in aze["gps"] else ""
        val_m = val / 1e6 if val else 0.0
        print(f"Year {year}: {val_m:.3f} Million visitors{gp_str}")
