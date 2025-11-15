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
DEFAULT_SEED = 42


def set_seed(seed: int = DEFAULT_SEED):
    random.seed(seed)
    np.random.seed(seed)


def ensure_out_dir(out_path: str):
    os.makedirs(os.path.dirname(out_path) or ".", exist_ok=True)


def gen_billing_csv(days=365, projects=30, out_path="data/synthetic_billing.csv"):
    """
    Generate a synthetic billing CSV with 'days' rows * projects.
    Returns the DataFrame.
    """
    ensure_out_dir(out_path)
    rows = []
    start = datetime.utcnow() - timedelta(days=days - 1)
    for d in range(days):
        day_ts = (start + timedelta(days=d)).strftime("%Y-%m-%d")
        for p in range(1, projects + 1):
            base = np.random.uniform(5, 25)  # baseline daily cost
            # inject occasional large anomalies
            if ((d % 13 == 1 or d % 38 == 2) and p % 3 == 0):
                cost = base + 250 + np.random.uniform(0, 100)
            else:
                cost = max(base + np.random.normal(1, 5), 0.01)
            rows.append({
                "project_id": f"proj-{p}",
                "usage_start_time": day_ts,
                "service": np.random.choice(["Compute Engine", "Cloud Storage", "BigQuery", "Dataflow"]),
                "sku": "sku-" + str(np.random.randint(1000, 9999)),
                "region": np.random.choice(["us-central1", "europe-west1", "asia-south1"]),
                "cost": round(cost, 2),
                "credits": round(np.random.choice([0, 0, 0, 5]), 2)  # mostly zero credits
            })
    df = pd.DataFrame(rows)
    df.to_csv(out_path, index=False)
    return df


def gen_metrics_jsonl(days=365, out_path="data/synthetic_metrics.jsonl"):
    """
    Generate synthetic monitoring metrics (JSON lines) for a few instances.
    Returns the list of metrics dicts.
    """
    ensure_out_dir(out_path)
    metrics = []
    instances = ["vm-prod-1", "vm-dev-1", "vm-batch-1"]
    start = datetime.utcnow() - timedelta(days=days - 1)
    for i in range(days):
        ts = (start + timedelta(days=i)).isoformat()
        for inst in instances:
            # mostly low CPU for dev, moderate for prod, occasional spikes for batch
            if inst == "vm-dev-1":
                cpu = np.random.choice([1, 2, 3])
            elif inst == "vm-prod-1":
                cpu = np.random.normal(30, 5)
            else:
                cpu = np.random.normal(10, 6)

            # forced spikes on some cadence
            if i % 9 == 0 and inst == "vm-prod-1":
                cpu = 95.0
            if i % 7 == 0 and inst == "vm-dev-1":
                cpu = 97.0

            metrics.append({
                "timestamp": ts,
                "instance": inst,
                "cpu_util": float(max(0, round(cpu, 2))),
                "region": np.random.choice(["us-central1", "europe-west1"])
            })
    with open(out_path, "w") as f:
        for m in metrics:
            f.write(json.dumps(m) + "\n")
    return metrics


def gen_assets_json(out_path="data/assets.json"):
    """
    Generate a small assets JSON.
    Returns the list of asset objects.
    """
    ensure_out_dir(out_path)
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
    set_seed(seed)
    os.makedirs(out_dir, exist_ok=True)
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
