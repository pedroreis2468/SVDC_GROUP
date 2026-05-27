import json
import os

# Use absolute path relative to this script's directory
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
json_path = os.path.join(base_dir, 'data', 'processed_data.json')

with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

prt = data['countries']['PRT']
print(f"Country: {prt['name']}")
print(f"GP Years: {prt['gps']}")

for ind, history in prt['indicators'].items():
    gp_vals = []
    nongp_vals = []
    
    # Exclude 2008, 2009, 2020, 2021
    EXCLUDED = {2008, 2009, 2020, 2021}
    gps_set = set(prt['gps'])
    
    for year, val in history.items():
        y = int(year)
        if y <= 2024 and y not in EXCLUDED:
            if y in gps_set:
                gp_vals.append(val)
            else:
                nongp_vals.append(val)
                
    avg_gp = sum(gp_vals)/len(gp_vals) if gp_vals else 0
    avg_nongp = sum(nongp_vals)/len(nongp_vals) if nongp_vals else 0
    diff = avg_gp - avg_nongp
    
    print(f"\nIndicator: {ind}")
    print(f"  GP Years Avg: {avg_gp:.4f}")
    print(f"  Non-GP Years Avg: {avg_nongp:.4f}")
    print(f"  Difference: {diff:+.4f}")
    
    # Show predictions
    pred_2026 = prt['predictions']['2026'][ind]
    print(f"  2026 Forecast - With GP: {pred_2026['with_gp']:.4f}, Without GP: {pred_2026['without_gp']:.4f}, Lift: {pred_2026['with_gp'] - pred_2026['without_gp']:+.4f}")
