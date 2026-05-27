import json
import numpy as np

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

aze = data["countries"]["AZE"]
EXCLUDED = {2008, 2009, 2020, 2021}

for ind in ["FDI", "Tourism_arrivals", "GDP_growth"]:
    history = aze["indicators"][ind]
    gps_set = set(aze["gps"])
    
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
                    
    print(f"\nIndicator: {ind}")
    if gp_vals:
        print(f"  GP Years (Count={len(gp_vals)}):")
        print(f"    Mean: {np.mean(gp_vals):.2f}%")
        print(f"    Median: {np.median(gp_vals):.2f}%")
    else:
        print("  GP Years: No data")
        
    if nongp_vals:
        print(f"  Non-GP Years (Count={len(nongp_vals)}):")
        print(f"    Mean: {np.mean(nongp_vals):.2f}%")
        print(f"    Median: {np.median(nongp_vals):.2f}%")
    else:
        print("  Non-GP Years: No data")
