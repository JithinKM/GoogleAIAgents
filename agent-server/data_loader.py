import json
import pandas as pd
from pathlib import Path
from typing import List
import data_generator as dg
import logging

# Configure logging
logger = logging.getLogger(__name__)

# Make defaults
DATA_DIR = Path("../data")
BILLING_CSV = DATA_DIR / "synthetic_billing.csv"
METRICS_JSONL = DATA_DIR / "synthetic_metrics.jsonl"
ASSETS_JSON = DATA_DIR / "assets.json"

# Local in-memory caches
billing_df: pd.DataFrame = pd.DataFrame()
metrics_list: List[dict] = []
assets_list: List[dict] = []

def load_or_generate_data(generate_if_missing: bool = True):
    """
    Loads data from ./data; if any file is missing and generate_if_missing True,
    generate all files with data_generator.generate_all().
    """
    global billing_df, metrics_list, assets_list

    missing = []
    for path in (BILLING_CSV, METRICS_JSONL, ASSETS_JSON):
        if not path.exists():
            missing.append(path)

    if missing:
        if generate_if_missing:
            logger.info("Missing data files found — generating synthetic data...")
            dg.generate_all(out_dir=str(DATA_DIR), days=365, projects=30)
        else:
            raise FileNotFoundError(f"Missing data files: {missing}")

    # load billing as DataFrame
    billing_df = pd.read_csv(BILLING_CSV, parse_dates=["usage_start_time"])
    # load metrics as list of dicts
    with open(METRICS_JSONL, "r") as f:
        metrics_list = [json.loads(l) for l in f]
    # assets
    with open(ASSETS_JSON, "r") as f:
        assets_list = json.load(f)

    logger.info("Loaded data:")
    logger.info(f" - billing rows: {len(billing_df)}")
    logger.info(f" - metrics lines: {len(metrics_list)}")
    logger.info(f" - assets: {len(assets_list)}")

def get_billing_df():
    return billing_df

def get_metrics_list():
    return metrics_list

def get_assets_list():
    return assets_list
