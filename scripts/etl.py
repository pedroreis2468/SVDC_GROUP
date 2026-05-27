import os
import urllib.request
import zipfile
import csv
import json
import math
import sys
import numpy as np
from sklearn.linear_model import LinearRegression, Ridge
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_absolute_error
from xgboost import XGBRegressor

# Configure stdout to handle UTF-8 printing on Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# 1. Define paths and constants
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, 'data')
SCRIPTS_DIR = os.path.join(BASE_DIR, 'scripts')

ERGAST_ZIP_URL = "https://raceoptidatapublicfiles.blob.core.windows.net/ergast2024/ergast_2024.zip"
ERGAST_ZIP_PATH = os.path.join(DATA_DIR, 'ergast_2024.zip')

INDICATORS = {
    "GDP_growth": "NY.GDP.MKTP.KD.ZG",       # GDP growth (annual %)
    "GDP_pc": "NY.GDP.PCAP.KD",             # GDP per capita (constant 2015 US$)
    "Inflation": "FP.CPI.TOTL.ZG",          # Inflation, consumer prices (annual %)
    "Tourism_arrivals": "ST.INT.ARVL",      # International tourism, arrivals
    "FDI": "BX.KLT.DINV.CD.WD"              # Foreign direct investment, net inflows (current USD)
}

# Exclude economic crisis years (2008-2009) and pandemic years (2020-2021) from model training to avoid external shock bias.
EXCLUDED_ANOMALY_YEARS = {2008, 2009, 2020, 2021}


# Country name mapping from Ergast F1 to ISO-3 codes
F1_COUNTRY_TO_ISO = {
    "Australia": "AUS",
    "Austria": "AUT",
    "Argentina": "ARG",
    "Azerbaijan": "AZE",
    "Bahrain": "BHR",
    "Belgium": "BEL",
    "Brazil": "BRA",
    "Canada": "CAN",
    "China": "CHN",
    "France": "FRA",
    "Germany": "DEU",
    "Hungary": "HUN",
    "India": "IND",
    "Italy": "ITA",
    "Japan": "JPN",
    "Malaysia": "MYS",
    "Mexico": "MEX",
    "Monaco": "MCO",
    "Morocco": "MAR",
    "Netherlands": "NLD",
    "Portugal": "PRT",
    "Russia": "RUS",
    "Saudi Arabia": "SAU",
    "Singapore": "SGP",
    "South Africa": "ZAF",
    "Spain": "ESP",
    "Sweden": "SWE",
    "Switzerland": "CHE",
    "Turkey": "TUR",
    "UAE": "ARE",
    "United Arab Emirates": "ARE",
    "UK": "GBR",
    "United Kingdom": "GBR",
    "USA": "USA",
    "United States": "USA",
    "Korea": "KOR",
    "South Korea": "KOR",
    "Qatar": "QAT"
}

def solve_linear_regression(X, Y):
    """
    Solves OLS linear regression (X^T X)^-1 X^T Y using Gaussian elimination.
    X: list of lists (N x K), Y: list of floats (N)
    Returns list of coefficients (size K)
    """
    N = len(X)
    K = len(X[0])
    
    # Compute X^T X
    XTX = [[0.0]*K for _ in range(K)]
    for i in range(K):
        for j in range(K):
            for n in range(N):
                XTX[i][j] += X[n][i] * X[n][j]
                
    # Compute X^T Y
    XTY = [0.0]*K
    for i in range(K):
        for n in range(N):
            XTY[i] += X[n][i] * Y[n]
            
    # Solve XTX * beta = XTY using Gaussian elimination
    # Solve the augmented matrix [XTX | XTY]
    A = [XTX[i] + [XTY[i]] for i in range(K)]
    
    for i in range(K):
        # Find pivot
        pivot_row = i
        for r in range(i+1, K):
            if abs(A[r][i]) > abs(A[pivot_row][i]):
                pivot_row = r
        A[i], A[pivot_row] = A[pivot_row], A[i]
        
        pivot = A[i][i]
        if abs(pivot) < 1e-12:
            return [0.0] * K # Singular, return fallback
            
        # Normalize row
        for j in range(i, K+1):
            A[i][j] /= pivot
            
        # Eliminate other rows
        for r in range(K):
            if r != i:
                factor = A[r][i]
                for j in range(i, K+1):
                    A[r][j] -= factor * A[i][j]
                    
    return [A[i][K] for i in range(K)]

def download_file(url, dest):
    print(f"Downloading {url} to {dest}...")
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req) as response, open(dest, 'wb') as out_file:
        out_file.write(response.read())
    print("Download completed.")

def main():
    # Ensure data directory exists
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
        print(f"Created directory: {DATA_DIR}")

    # 2. Download and extract Ergast F1 Data
    if not os.path.exists(ERGAST_ZIP_PATH):
        try:
            download_file(ERGAST_ZIP_URL, ERGAST_ZIP_PATH)
        except Exception as e:
            print(f"Error downloading F1 data: {e}")
            sys.exit(1)

    print("Extracting F1 database files...")
    races_csv_path = os.path.join(DATA_DIR, 'races.csv')
    circuits_csv_path = os.path.join(DATA_DIR, 'circuits.csv')
    
    with zipfile.ZipFile(ERGAST_ZIP_PATH, 'r') as zip_ref:
        zip_ref.extract('races.csv', DATA_DIR)
        zip_ref.extract('circuits.csv', DATA_DIR)
    print("Extraction completed.")

    # 3. Parse Circuits and Races
    print("Parsing circuits...")
    circuits = {}
    with open(circuits_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            circuits[row['circuitId']] = {
                'name': row['name'],
                'country': row['country'].strip()
            }

    print("Parsing races...")
    # gp_history[iso3] = set of years they hosted a race
    gp_history = {}
    with open(races_csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            year = int(row['year'])
            circuit_id = row['circuitId']
            if circuit_id in circuits:
                f1_country = circuits[circuit_id]['country']
                iso3 = F1_COUNTRY_TO_ISO.get(f1_country)
                if iso3:
                    if iso3 not in gp_history:
                        gp_history[iso3] = set()
                    gp_history[iso3].add(year)
                else:
                    # Log unmapped country if any
                    pass

    # 4. Fetch World Bank Data
    wb_data = {} # wb_data[iso3][indicator][year] = value
    
    for key, indicator_code in INDICATORS.items():
        print(f"Fetching World Bank indicator {key} ({indicator_code})...")
        # Fetch data for all countries from 1960 to 2024
        # We use format=json and per_page=25000 to get all values in a single call
        url = f"http://api.worldbank.org/v2/country/all/indicator/{indicator_code}?format=json&per_page=25000&date=1960:2024"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req) as response:
                res = json.loads(response.read().decode('utf-8'))
            
            if len(res) > 1:
                data_list = res[1]
                for item in data_list:
                    iso3 = item['countryiso3code']
                    # Skip if country code is blank (some regional aggregates might have it blank, we only want valid ISO-3)
                    if not iso3:
                        continue
                    year = int(item['date'])
                    val = item['value']
                    
                    if iso3 not in wb_data:
                        wb_data[iso3] = {k: {} for k in INDICATORS.keys()}
                    
                    if val is not None:
                        wb_data[iso3][key][year] = float(val)
            else:
                print(f"No data returned for indicator {key}")
        except Exception as e:
            print(f"Error fetching indicator {key}: {e}")

    # 5. Clean, Align, and Merge Datasets
    # We only care about countries that have hosted a GP at least once OR are of interest (like Portugal)
    target_countries = set(gp_history.keys())
    target_countries.add("PRT") # Ensure Portugal is included

    # Impute missing recent tourism and other indicators for 2021-2024 to avoid empty gaps in the dashboard
    print("Imputing and forward-filling missing recent years (2021-2024)...")
    for iso3 in target_countries:
        if iso3 in wb_data:
            for ind in INDICATORS.keys():
                history = wb_data[iso3][ind]
                # Special recovery logic for tourism
                if ind == "Tourism_arrivals":
                    baseline_2019 = history.get(2019)
                    if baseline_2019:
                        recovery_factors = {
                            2021: 0.55,  # 55% recovery
                            2022: 0.92,  # 92% recovery
                            2023: 1.06,  # 106% recovery (growth)
                            2024: 1.12   # 112% recovery
                        }
                        for yr, factor in recovery_factors.items():
                            if yr not in history or history[yr] is None:
                                history[yr] = round(baseline_2019 * factor)
                
                # General forward-fill for any missing years from 2020 to 2024
                for yr in range(2020, 2025):
                    if yr not in history or history[yr] is None:
                        prev_yr = yr - 1
                        if prev_yr in history and history[prev_yr] is not None:
                            history[yr] = history[prev_yr]

    # Add country names from World Bank response or standard mapping
    # Let's map ISO-3 to full country names
    iso_to_name = {
        "PRT": "Portugal", "USA": "United States", "GBR": "United Kingdom",
        "ITA": "Italy", "ESP": "Spain", "FRA": "France", "DEU": "Germany",
        "BRA": "Brazil", "JPN": "Japan", "AUS": "Australia", "CAN": "Canada",
        "BEL": "Belgium", "MCO": "Monaco", "HUN": "Hungary", "AUT": "Austria",
        "BHR": "Bahrain", "SGP": "Singapore", "ARE": "United Arab Emirates",
        "CHN": "China", "TUR": "Turkey", "MYS": "Malaysia", "MEX": "Mexico",
        "ZAF": "South Africa", "ARG": "Argentina", "SWE": "Sweden", "CHE": "Switzerland",
        "NLD": "Netherlands", "RUS": "Russia", "AZE": "Azerbaijan", "SAU": "Saudi Arabia",
        "QAT": "Qatar", "IND": "India", "KOR": "South Korea", "MAR": "Morocco"
    }

    # 6. Calculate Global GP Impact Lift (within-country approach)
    global_gp_lifts = {}
    for ind in INDICATORS.keys():
        country_diffs = []

        for iso3 in gp_history.keys():
            if iso3 not in wb_data:
                continue
            history = wb_data[iso3][ind]
            gps = gp_history[iso3]

            gp_vals = []
            nongp_vals = []

            for y in range(1961, 2025):
                if y not in history:
                    continue
                if y in EXCLUDED_ANOMALY_YEARS:
                    continue

                if ind in ["GDP_growth", "Inflation", "Unemployment"]:
                    # Rate/percentage indicator: use the value directly (level comparison)
                    val = history[y]
                else:
                    # Absolute-level indicator (Tourism_arrivals, GDP_pc, FDI): convert to within-country YoY % growth
                    # so that small and large economies are comparable.
                    if (y - 1) not in history or history[y - 1] == 0:
                        continue
                    val = (history[y] - history[y - 1]) / abs(history[y - 1]) * 100.0
                    if ind == "FDI":
                        val = max(-100.0, min(val, 200.0)) # Clip FDI growth to prevent outlier distortion

                if y in gps:
                    gp_vals.append(val)
                else:
                    nongp_vals.append(val)

            # Only include this country if it has both GP and non-GP observations
            # (countries that always hosted — UK every year — are excluded because
            # they have no non-GP years and cannot contribute a within-country diff)
            if gp_vals and nongp_vals:
                country_lift = sum(gp_vals) / len(gp_vals) - sum(nongp_vals) / len(nongp_vals)
                country_diffs.append(country_lift)

        global_gp_lifts[ind] = sum(country_diffs) / len(country_diffs) if country_diffs else 0.0

    print("Calculated Global GP Lifts (within-country fixed-effects approach):")
    for k, v in global_gp_lifts.items():
        print(f" - {k}: {v:+.4f}")

    # Calculate Global Averages for each year and indicator across F1-hosting countries
    global_averages = {ind: {} for ind in INDICATORS.keys()}
    for ind in INDICATORS.keys():
        for y in range(1960, 2025):
            vals = []
            for iso3 in target_countries:
                if iso3 in wb_data and ind in wb_data[iso3] and y in wb_data[iso3][ind]:
                    vals.append(wb_data[iso3][ind][y])
            if vals:
                global_averages[ind][str(y)] = sum(vals) / len(vals)

    # 7. Model Fitting and Forecasting (2026-2027)
    final_output = {
        "countries": {},
        "global_gp_lifts": global_gp_lifts,
        "global_averages": global_averages
    }

    for iso3 in target_countries:
        if iso3 not in wb_data:
            continue
            
        country_name = iso_to_name.get(iso3, iso3)
        gps = list(gp_history.get(iso3, set()))
        gps.sort()
        
        country_record = {
            "name": country_name,
            "gps": gps,
            "indicators": {},
            "predictions": {
                "xgboost": {
                    "2026": {"GP_hosted_actual": False},
                    "2027": {"GP_hosted_actual": False}
                },
                "ridge": {
                    "2026": {"GP_hosted_actual": False},
                    "2027": {"GP_hosted_actual": False}
                },
                "rf": {
                    "2026": {"GP_hosted_actual": False},
                    "2027": {"GP_hosted_actual": False}
                },
                "metrics": {
                    "xgboost": {},
                    "ridge": {},
                    "rf": {}
                }
            }
        }
        
        # Populate historical indicators
        for ind in INDICATORS.keys():
            country_record["indicators"][ind] = wb_data[iso3][ind]

        # For predictions, we build a model for each indicator
        for ind in INDICATORS.keys():
            history = wb_data[iso3][ind]
            gps_set = gp_history.get(iso3, set())
            
            # Prepare regression data: Y_t = b0 + b1 * Y_t-1 + b2 * GP_t + b3 * year
            X = []
            Y = []
            
            for y in range(1961, 2025):
                if y in history and (y-1) in history:
                    # Skip economic crises and pandemic years to prevent bias in individual model parameters
                    if y in EXCLUDED_ANOMALY_YEARS:
                        continue
                    # Features: [Y_t-1, GP_t, year]
                    gp_val = 1.0 if y in gps_set else 0.0
                    X.append([history[y-1], gp_val, float(y)])
                    Y.append(history[y])
            
            has_hosted = len(gps_set) > 0
            b2 = 0.0
            
            if len(Y) >= 10:
                X_np = np.array(X)
                Y_np = np.array(Y)
                
                # Fit OLS (needed only for b2 coefficient)
                ols = LinearRegression()
                ols.fit(X_np, Y_np)
                if has_hosted:
                    b2 = ols.coef_[1]
                
                # Fit XGBoost
                xgb = XGBRegressor(n_estimators=50, max_depth=3, learning_rate=0.1, random_state=42)
                xgb.fit(X_np, Y_np)
                
                # Fit Ridge
                ridge = Ridge(alpha=10.0)
                ridge.fit(X_np, Y_np)
                
                # Fit Random Forest
                rf = RandomForestRegressor(n_estimators=50, max_depth=4, random_state=42)
                rf.fit(X_np, Y_np)
                
                country_record["predictions"]["metrics"]["xgboost"][ind] = {
                    "r2": round(float(r2_score(Y_np, xgb.predict(X_np))), 2),
                    "mae": round(float(mean_absolute_error(Y_np, xgb.predict(X_np))), 2)
                }
                country_record["predictions"]["metrics"]["ridge"][ind] = {
                    "r2": round(float(r2_score(Y_np, ridge.predict(X_np))), 2),
                    "mae": round(float(mean_absolute_error(Y_np, ridge.predict(X_np))), 2)
                }
                country_record["predictions"]["metrics"]["rf"][ind] = {
                    "r2": round(float(r2_score(Y_np, rf.predict(X_np))), 2),
                    "mae": round(float(mean_absolute_error(Y_np, rf.predict(X_np))), 2)
                }
            else:
                country_record["predictions"]["metrics"]["xgboost"][ind] = {"r2": 0.0, "mae": 0.0}
                country_record["predictions"]["metrics"]["ridge"][ind] = {"r2": 0.0, "mae": 0.0}
                country_record["predictions"]["metrics"]["rf"][ind] = {"r2": 0.0, "mae": 0.0}

            # Filtrar anos de anomalia para verificar a recência real
            valid_gps = [y for y in gps_set if y not in EXCLUDED_ANOMALY_YEARS]
            GP_RECENCY_THRESHOLD = 2005
            gp_effect = b2
            use_global_fallback = False
            
            # Condições para rejeitar o b2 específico do país e usar o global lift
            if (len(gps_set) < 5
                    or abs(b2) < 1e-6
                    or not valid_gps
                    or max(valid_gps) < GP_RECENCY_THRESHOLD):
                gp_effect = global_gp_lifts[ind]
                use_global_fallback = True
            
            # Now let's forecast 2026 and 2027
            years_sorted = sorted(list(history.keys()))
            if not years_sorted:
                continue
            
            latest_year = years_sorted[-1]
            latest_val = history[latest_year]
            gp_2025 = 1.0 if 2025 in gps_set else 0.0
            
            for m_key in ["xgboost", "ridge", "rf"]:
                if len(Y) >= 10:
                    model = xgb if m_key == "xgboost" else (ridge if m_key == "ridge" else rf)
                    
                    # Project to 2025
                    val_2025 = float(model.predict([[latest_val, gp_2025, 2025.0]])[0])
                    min_hist = min(history.values())
                    max_hist = max(history.values())
                    val_2025 = max(min(val_2025, max_hist * 1.5), min_hist * 1.5)
                    
                    # Predict 2026 without GP
                    pred_2026_without = float(model.predict([[val_2025, 0.0, 2026.0]])[0])
                    
                    # Predict 2026 with GP
                    if use_global_fallback:
                        if ind in ["GDP_growth", "Inflation", "Unemployment"]:
                            pred_2026_with = pred_2026_without + gp_effect
                        else:
                            pred_2026_with = pred_2026_without * (1 + gp_effect / 100.0)
                    else:
                        pred_2026_with = float(model.predict([[val_2025, 1.0, 2026.0]])[0])
                        
                    # Cap predictions
                    if ind in ["Tourism_arrivals", "GDP_pc", "Unemployment"]:
                        pred_2026_without = max(0.0, pred_2026_without)
                        pred_2026_with = max(0.0, pred_2026_with)
                        
                    # Predict 2027
                    pred_2027_without = float(model.predict([[pred_2026_without, 0.0, 2027.0]])[0])
                    if use_global_fallback:
                        if ind in ["GDP_growth", "Inflation", "Unemployment"]:
                            pred_2027_with = pred_2027_without + gp_effect
                        else:
                            pred_2027_with = pred_2027_without * (1 + gp_effect / 100.0)
                    else:
                        pred_2027_with = float(model.predict([[pred_2026_without, 1.0, 2027.0]])[0])
                        
                    # Cap predictions
                    if ind in ["Tourism_arrivals", "GDP_pc", "Unemployment"]:
                        pred_2027_without = max(0.0, pred_2027_without)
                        pred_2027_with = max(0.0, pred_2027_with)
                else:
                    # Sparse fallback
                    val_2025 = latest_val
                    pred_2026_without = latest_val
                    if ind in ["GDP_growth", "Inflation", "Unemployment"]:
                        pred_2026_with = pred_2026_without + gp_effect
                    else:
                        pred_2026_with = pred_2026_without * (1 + gp_effect / 100.0)
                    pred_2026_without = max(0.0, pred_2026_without) if ind in ["Tourism_arrivals", "GDP_pc", "Unemployment"] else pred_2026_without
                    pred_2026_with = max(0.0, pred_2026_with) if ind in ["Tourism_arrivals", "GDP_pc", "Unemployment"] else pred_2026_with
                    
                    pred_2027_without = pred_2026_without
                    if ind in ["GDP_growth", "Inflation", "Unemployment"]:
                        pred_2027_with = pred_2027_without + gp_effect
                    else:
                        pred_2027_with = pred_2027_without * (1 + gp_effect / 100.0)
                    pred_2027_without = max(0.0, pred_2027_without) if ind in ["Tourism_arrivals", "GDP_pc", "Unemployment"] else pred_2027_without
                    pred_2027_with = max(0.0, pred_2027_with) if ind in ["Tourism_arrivals", "GDP_pc", "Unemployment"] else pred_2027_with
                    
                # Convert predictions for absolute indicators
                if ind in ["Tourism_arrivals", "GDP_pc", "FDI"]:
                    baseline_2025 = val_2025 if val_2025 != 0.0 else 1.0
                    yoy_2026_with = ((pred_2026_with - baseline_2025) / abs(baseline_2025)) * 100.0
                    yoy_2026_without = ((pred_2026_without - baseline_2025) / abs(baseline_2025)) * 100.0
                    
                    baseline_2026 = pred_2026_without if pred_2026_without != 0.0 else 1.0
                    yoy_2027_with = ((pred_2027_with - baseline_2026) / abs(baseline_2026)) * 100.0
                    yoy_2027_without = ((pred_2027_without - baseline_2026) / abs(baseline_2026)) * 100.0
                    
                    country_record["predictions"][m_key]["2026"][ind] = {
                        "with_gp": round(yoy_2026_with, 2),
                        "without_gp": round(yoy_2026_without, 2),
                        "baseline": round(baseline_2025, 2)
                    }
                    country_record["predictions"][m_key]["2027"][ind] = {
                        "with_gp": round(yoy_2027_with, 2),
                        "without_gp": round(yoy_2027_without, 2),
                        "baseline": round(baseline_2026, 2)
                    }
                else:
                    country_record["predictions"][m_key]["2026"][ind] = {
                        "with_gp": round(pred_2026_with, 2),
                        "without_gp": round(pred_2026_without, 2),
                        "baseline": round(val_2025, 2)
                    }
                    country_record["predictions"][m_key]["2027"][ind] = {
                        "with_gp": round(pred_2027_with, 2),
                        "without_gp": round(pred_2027_without, 2),
                        "baseline": round(pred_2026_without, 2)
                    }
            
        final_output["countries"][iso3] = country_record

    # 8. Write to processed_data.json
    output_file_path = os.path.join(DATA_DIR, 'processed_data.json')
    with open(output_file_path, 'w', encoding='utf-8') as out_f:
        json.dump(final_output, out_f, indent=2, ensure_ascii=False)
        
    print(f"ETL completed successfully! Conserved data for {len(final_output['countries'])} countries.")
    print(f"Output written to: {output_file_path}")

if __name__ == '__main__':
    main()