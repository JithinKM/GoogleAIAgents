"""
Synthetic data generator helpers for cloud cost experiments.

Functions:
- set_seed(seed)
- gen_billing_csv(days=365, projects=30, out_path="data/synthetic_billing.csv")
- gen_metrics_jsonl(days=365, out_path="data/synthetic_metrics.jsonl")
- gen_assets_json(out_path="data/assets.json")
- generate_all(out_dir="data", days=365, projects=30)

Run as a script to produce files under ./data/.
"""
import os
import json
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd

# default deterministic seed
DEFAULT_SEED = 12345
random.seed(DEFAULT_SEED)
np.random.seed(DEFAULT_SEED)

OUT_DIR = "../data"
os.makedirs(OUT_DIR, exist_ok=True)

# helper: map project to a primary service and an instance (so billing anomalies can be correlated to metrics)
def project_metadata(p):
    # rotate services so projects look realistic
    services = ["Compute Engine", "Cloud Storage", "BigQuery", "Dataflow", "Cloud Run"]
    instances = ["vm-prod-1", "vm-dev-1", "vm-batch-1", "vm-analytics-1"]
    svc = services[(p-1) % len(services)]
    inst = instances[(p-1) % len(instances)]
    return svc, inst

# --- billing CSV (365 days, 30 projects, with seasonal patterns and specific anomalies) ---
def gen_billing_csv(days=365, projects=30, out_path=OUT_DIR + "/synthetic_billing.csv"):
    rows = []
    start = datetime.utcnow() - timedelta(days=days-1)

    # global seasonal pattern: yearly trend + weekly seasonality + occasional promotions/credits
    for d in range(days):
        day_date = start + timedelta(days=d)
        day_ts = day_date.strftime("%Y-%m-%d")
        day_of_year = day_date.timetuple().tm_yday
        weekday = day_date.weekday()  # 0=Mon .. 6=Sun

        # seasonal multipliers
        yearly_season = 1.0 + 0.25 * np.sin(2 * np.pi * (day_of_year / 365.0))  # mild yearly seasonality
        weekly_season = 1.0 + 0.15 * (1 if weekday in (0,1,2,3,4) else -0.05)   # weekdays slightly higher
        trend = 1.0 + (d / 365.0) * 0.10  # slow upward trend across the year

        for p in range(1, projects+1):
            svc, inst = project_metadata(p)
            # base cost depends on service (BigQuery & Dataflow costlier)
            service_base = {
                "Compute Engine": 10,
                "Cloud Storage": 2,
                "BigQuery": 20,
                "Dataflow": 18,
                "Cloud Run": 7
            }[svc]

            # project scale factor (some projects are larger)
            scale = 1.0 + ((p % 5) * 0.35)  # variety in project sizes

            # normal noise and micro-spikes due to load
            noise = np.random.normal(0, service_base * 0.08)

            # baseline cost combining factors
            base_cost = service_base * scale * yearly_season * weekly_season * trend + noise

            # Occasionally inject "explainable" anomalies:
            # - scheduled monthly batch job: day_of_year % 30 == project_mod triggers increased Dataflow/Compute usage
            proj_mod_trigger = (day_of_year + p) % 30 == 0
            # - randomized incident windows for some projects (more realistic than fixed periodic)
            incident_chance = 0.002  # low probability per project/day
            incident_happens = random.random() < incident_chance

            # Large anomaly for specific rule: if Dataflow project and a monthly batch triggers
            anomaly = 0.0
            if svc == "Dataflow" and proj_mod_trigger:
                anomaly += service_base * scale * 8.0  # large batch job cost
            # Another anomaly pattern: every 90 days, some projects (p%7==0) have a cost spike (e.g., release/test)
            if d % 90 == (p % 7):
                anomaly += service_base * scale * 6.0

            # random incident
            if incident_happens:
                anomaly += service_base * scale * np.random.uniform(10, 30)

            cost = max(base_cost + anomaly, 0.01)

            # credits: small chance of promotional or committed-use credits
            credits = 0.0
            if random.random() < 0.01:
                credits = round(service_base * np.random.uniform(0.5, 3.0), 2)

            rows.append({
                "project_id": f"proj-{p}",
                "usage_start_time": day_ts,
                "service": svc,
                "sku": f"sku-{svc[:3].upper()}-{(p*13)%10000}",
                "region": np.random.choice(["us-central1","europe-west1","asia-south1"]),
                "cost": round(cost, 2),
                "credits": round(credits, 2),
                "instance": inst
            })

    df = pd.DataFrame(rows)
    df.to_csv(out_path, index=False)
    return df

# --- monitoring metrics JSONL (per instance), correlated with billing anomalies ---
def gen_metrics_jsonl(days=365, out_path=OUT_DIR + "/synthetic_metrics.jsonl"):
    metrics = []
    instances = ["vm-prod-1","vm-dev-1","vm-batch-1","vm-analytics-1"]
    start = datetime.utcnow() - timedelta(days=days-1)

    for i in range(days):
        day_date = start + timedelta(days=i)
        day_ts = day_date.isoformat()
        day_of_year = day_date.timetuple().tm_yday
        weekday = day_date.weekday()

        for inst in instances:
            # role-based baseline CPU
            if inst == "vm-prod-1":
                base_cpu = 30 + 5 * np.sin(2 * np.pi * (day_of_year / 30.0))  # monthly variability
            elif inst == "vm-dev-1":
                base_cpu = 5 + (2 if weekday >=5 else 0)  # devs higher on weekends sometimes
            elif inst == "vm-batch-1":
                base_cpu = 10 + 15 * (1 if day_of_year % 7 == 0 else 0)  # weekly batch spikes
            else:  # vm-analytics-1
                base_cpu = 20 + 8 * np.sin(2 * np.pi * (day_of_year / 14.0))  # bi-weekly trend

            # add small noise
            cpu = base_cpu + np.random.normal(0, 3.0)

            # correlate with billing anomalies:
            # if on this day any project that maps to this instance had a big anomaly, raise CPU
            # We'll check billing_df (regenerate if not present) — but to keep this function standalone,
            # we also re-create the same deterministic conditions used in gen_billing_csv.
            # We'll simulate a Dataflow monthly batch effect for instances that host Dataflow projects.
            # If inst is vm-batch-1 or vm-prod-1 and day_of_year modulo conditions match, spike CPU.
            if inst in ("vm-batch-1", "vm-prod-1"):
                if day_of_year % 30 == 0:
                    cpu += np.random.uniform(30, 70)  # batch or monthly peak
            # occasional incident aligned with billing incident probability
            if random.random() < 0.002:
                cpu += np.random.uniform(40, 90)

            # clip to reasonable [0,100]
            cpu_val = float(max(0.0, min(100.0, round(cpu, 2))))
            metrics.append({"timestamp": day_ts, "instance": inst, "cpu_util": cpu_val, "region": np.random.choice(["us-central1","europe-west1"])})

    with open(out_path, "w") as f:
        for m in metrics:
            f.write(json.dumps(m) + "\n")
    return metrics


def gen_assets_json(out_path="data/assets.json"):
    """
    Generate a small assets JSON.
    Returns the list of asset objects.
    """
    assets = [
        {"id": "disk-1", "type": "disk", "attached": False, "project": "proj-1", "size_gb": 100,
         "estimated_monthly_cost": 5.5},
        {"id": "ip-1", "type": "static-ip", "attached": False, "project": "proj-2", "estimated_monthly_cost": 7.2},
        {"id": "vm-prod-1", "type": "vm", "attached": True, "project": "proj-2", "cpu": 8, "ram_gb": 32},
        {"id": "vm-dev-1", "type": "vm", "attached": True, "project": "proj-1", "cpu": 2, "ram_gb": 8}
    ]
    with open(out_path, "w") as f:
        json.dump(assets, f, indent=2)
    return assets


def generate_all(out_dir="data", days=365, projects=30, seed=DEFAULT_SEED):
    """
    Convenience wrapper — sets seed and generates all three files under out_dir.
    Returns a dict of results with file paths and the created objects.
    """
    billing_path = os.path.join(out_dir, "synthetic_billing.csv")
    metrics_path = os.path.join(out_dir, "synthetic_metrics.jsonl")
    assets_path = os.path.join(out_dir, "assets.json")

    billing_df = gen_billing_csv(days=days, projects=projects, out_path=billing_path)
    metrics = gen_metrics_jsonl(days=days, out_path=metrics_path)
    assets = gen_assets_json(out_path=assets_path)

    return {
        "billing_csv": billing_path,
        "metrics_jsonl": metrics_path,
        "assets_json": assets_path,
        "billing_df": billing_df,
        "metrics": metrics,
        "assets": assets
    }


if __name__ == "__main__":
    # quick CLI to generate files
    results = generate_all(out_dir="data", days=365, projects=30)
    print("Generated files:")
    print(f" - {results['billing_csv']}")
    print(f" - {results['metrics_jsonl']}")
    print(f" - {results['assets_json']}")
