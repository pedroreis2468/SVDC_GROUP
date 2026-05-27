import json

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

aze = data["countries"]["AZE"]
fdi = aze["indicators"]["FDI"]
gps = aze["gps"]

print("AZE GP years:", gps)
print("\nAZE FDI history (year: value):")
for year in sorted(fdi.keys()):
    print(f"  {year}: {fdi[year]:,}")
