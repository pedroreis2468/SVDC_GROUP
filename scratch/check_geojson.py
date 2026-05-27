import urllib.request
import json

url = "https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson"
try:
    with urllib.request.urlopen(url) as response:
        geojson = json.loads(response.read().decode('utf-8'))
    
    ids = set()
    names = set()
    for feature in geojson["features"]:
        fid = feature.get("id") or feature.get("properties", {}).get("ISO_A3")
        name = feature.get("properties", {}).get("name")
        if fid: ids.add(fid)
        if name: names.add(name)
        
    f1_countries = ["SGP", "MCO", "BHR", "QAT", "AZE", "ARE", "PRT", "MAR"]
    for code in f1_countries:
        print(f"Code {code} in GeoJSON: {code in ids}")
except Exception as e:
    print("Error:", e)
