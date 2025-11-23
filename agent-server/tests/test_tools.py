import pytest
import pandas as pd
from unittest.mock import patch, MagicMock
import tools
import data_loader

@pytest.fixture
def mock_data():
    # Setup mock data in data_loader
    data_loader.billing_df = pd.DataFrame({
        "project_id": ["proj-a", "proj-a", "proj-b"],
        "cost": [10.0, 20.0, 5.0],
        "usage_start_time": [
            pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
            pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
            pd.Timestamp.utcnow().strftime("%Y-%m-%d")
        ]
    })
    data_loader.metrics_list = [{"cpu": 0.5}, {"cpu": 0.8}]
    yield
    # Teardown if needed

def test_bq_query_cost_by_project(mock_data):
    res = tools.bq_query_cost_by_project("proj-a", 30)
    assert len(res) == 1
    assert res[0]["project_id"] == "proj-a"
    assert res[0]["cost"] == 30.0

def test_bq_query_cost_empty(mock_data):
    res = tools.bq_query_cost_by_project("proj-c", 30)
    assert len(res) == 0

def test_monitoring_fetch_cpu(mock_data):
    res = tools.monitoring_fetch_cpu(1)
    assert len(res) == 1
    assert res[0] == {"cpu": 0.8}

def test_ticket_create():
    ticket = tools.ticket_create("Test Ticket", "Body")
    assert ticket["title"] == "Test Ticket"
    assert ticket["ticket_id"].startswith("TCK-")

def test_forecast_costs_linear():
    # Create a simple linear trend
    rows = []
    start = pd.Timestamp("2023-01-01")
    for i in range(10):
        rows.append({
            "usage_start_time": (start + pd.Timedelta(days=i)).isoformat(),
            "cost": 10 + i
        })
    
    res = tools.forecast_costs({"rows": rows})
    assert res["model"] == "linear+weekly"
    assert len(res["forecast"]) == 7
    # Check if prediction is roughly increasing
    assert res["forecast"][0]["predicted"] > 10
