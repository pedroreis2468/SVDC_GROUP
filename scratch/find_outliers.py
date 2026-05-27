import json
import numpy as np

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

EXCLUDED = {2008, 2009, 2020, 2021}

outliers = []

for code, cdata in data["countries"].items():
    gps_set = set(cdata["gps"])
    for ind in ["FDI", "Tourism_arrivals", "GDP_growth", "GDP_pc"]:
        history = cdata["indicators"].get(ind, {})
        if not history:
            continue
            
        gp_vals = []
        nongp_vals = []
        
        for year_str in sorted(history.keys()):
            y = int(year_str)
            if y <= 2024 and y not in EXCLUDED:
                val = history[year_str]
                if ind in ["Tourism_arrivals", "GDP_pc", "FDI"]:
                    prev_y = y - 1
                    if str(prev_y) in history and history[str(prev_y)] not in [None, 0] and prev_y not in EXCLUDED:
                        yoy = ((history[year_str] - history[str(prev_y)]) / abs(history[str(prev_y)])) * 100.0
                    else:
                        yoy = None
                else:
                    yoy = val
                    
                if yoy is not None:
                    if y in gps_set:
                        gp_vals.append(yoy)
                    else:
                        nongp_vals.append(yoy)
                        
        if gp_vals:
            gp_mean = np.mean(gp_vals)
            gp_med = np.median(gp_vals)
            if abs(gp_mean) > 100 or abs(gp_mean - gp_med) > 50:
                outliers.append((code, ind, "GP", gp_mean, gp_med))
        if nongp_vals:
            nongp_mean = np.mean(nongp_vals)
            nongp_med = np.median(nongp_vals)
            if abs(nongp_mean) > 100 or abs(nongp_mean - nongp_med) > 50:
                outliers.append((code, ind, "Non-GP", nongp_mean, nongp_med))

print(f"Found {len(outliers)} indicator-country-scenario pairs with extreme values or large mean-median gaps:")
for code, ind, scenario, mean_val, med_val in sorted(outliers, key=lambda x: -abs(x[3])):
    print(f"  {code} - {ind} ({scenario}): Mean = {mean_val:.2f}%, Median = {med_val:.2f}%")
