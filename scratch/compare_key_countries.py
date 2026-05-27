import json
import numpy as np

with open("c:/Users/mjurb/Desktop/MIA/2/svdc/data/processed_data.json", "r", encoding="utf-8") as f:
    data = json.load(f)

EXCLUDED = {2008, 2009, 2020, 2021}
countries = ["PRT", "GBR", "ESP", "AZE", "SAU"]

for code in countries:
    if code not in data["countries"]:
        continue
    cdata = data["countries"][code]
    print(f"\n=================== {code} ({cdata['name']}) ===================")
    gps_set = set(cdata["gps"])
    
    for ind in ["GDP_growth", "FDI", "Tourism_arrivals", "GDP_pc", "Inflation"]:
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
                        
        print(f"  {ind}:")
        if gp_vals:
            print(f"    GP (n={len(gp_vals)}): Mean={np.mean(gp_vals):.2f}%, Median={np.median(gp_vals):.2f}%")
        if nongp_vals:
            print(f"    Non-GP (n={len(nongp_vals)}): Mean={np.mean(nongp_vals):.2f}%, Median={np.median(nongp_vals):.2f}%")
