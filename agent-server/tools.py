import pandas as pd
import numpy as np
import math
import time
import logging
from typing import List
import data_loader

logger = logging.getLogger(__name__)

def bq_query_cost_by_project(project_id: str, num_days: int):
    # Access data from data_loader
    billing_df = data_loader.billing_df
    if billing_df.empty:
        logger.warning("Billing data is empty when querying cost.")
        return []
        
    cutoff = pd.Timestamp.utcnow() - pd.Timedelta(days=num_days)
    # Ensure usage_start_time is datetime if not already (it should be handled in loader but good to be safe)
    # Actually loader handles it.
    
    # We need to handle timezone awareness matching the loader
    # Loader parses dates, but let's check if we need to convert cutoff
    # The loader code: billing_df = pd.read_csv(..., parse_dates=["usage_start_time"])
    # In original code, there was some tz conversion logic in sequential_analysis, 
    # but bq_query_cost_by_project used string comparison: cutoff.strftime("%Y-%m-%d")
    
    # Original code:
    # cutoff = pd.Timestamp.utcnow() - pd.Timedelta(days=num_days)
    # df = billing_df[billing_df["usage_start_time"] >= cutoff.strftime("%Y-%m-%d")]
    
    # This relies on string comparison which might be fragile if column is datetime.
    # If column is datetime, comparing with string works in pandas often but let's be robust.
    # However, to preserve exact behavior I'll stick close to original but add safety.
    
    try:
        df = billing_df[billing_df["usage_start_time"] >= cutoff.strftime("%Y-%m-%d")]
        # Filter by project_id
        df = df[df["project_id"] == project_id]
        out = df.groupby("project_id").cost.sum().reset_index().to_dict(orient="records")
        return out
    except Exception as e:
        logger.error(f"Error in bq_query_cost_by_project: {e}")
        return []


def monitoring_fetch_cpu(days: int):
    # return up to last `days` entries
    metrics_list = data_loader.metrics_list
    return metrics_list[-days:]


def ticket_create(title: str, body: str):
    ticket = {
        "ticket_id": f"TCK-{abs(hash(title)) % 100000}",
        "title": title,
        "body": body,
        "created_at": time.time()
    }
    logger.info(f"Ticket created: {ticket}")
    return ticket


def forecast_costs(params: dict):
    rows = params.get("rows") or params.get("billing_rows_for_detector") or []
    horizon = 7
    if not rows:
        return {"forecast": [], "model": "none", "note": "no input rows"}
    
    try:
        df = pd.DataFrame(rows)
        # Ensure usage_start_time is datetime
        if "usage_start_time" in df.columns:
            df["usage_start_time"] = pd.to_datetime(df["usage_start_time"])
        else:
             return {"forecast": [], "model": "none", "note": "missing usage_start_time"}

        df = df.sort_values("usage_start_time").reset_index(drop=True)
        if df.empty:
             return {"forecast": [], "model": "none", "note": "empty dataframe"}
             
        start = df["usage_start_time"].min()
        df["x"] = (df["usage_start_time"] - start).dt.days.astype(float)
        y = df["cost"].astype(float).values
        x = df["x"].astype(float).values
        
        if len(x) < 2:
             return {"forecast": [], "model": "none", "note": "not enough data points"}

        w = 2 * math.pi / 7.0
        A = np.column_stack([np.ones_like(x), x, np.sin(w * x), np.cos(w * x)])
        try:
            coeffs, *_ = np.linalg.lstsq(A, y, rcond=None)
        except Exception:
            coeffs = np.zeros(A.shape[1])
        
        last_x = x[-1]
        preds = []
        for i in range(1, horizon + 1):
            xi = last_x + i
            vec = np.array([1.0, xi, math.sin(w * xi), math.cos(w * xi)])
            pred = float(np.dot(vec, coeffs))
            date = (start + pd.Timedelta(days=int(xi))).strftime("%Y-%m-%d")
            preds.append({"date": date, "predicted": round(max(pred, 0.0), 2)})
        return {"forecast": preds, "model": "linear+weekly", "coeffs": [float(c) for c in coeffs]}
    except Exception as e:
        logger.error(f"Error in forecast_costs: {e}")
        return {"forecast": [], "model": "error", "note": str(e)}
