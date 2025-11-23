from fastapi.testclient import TestClient
from unittest.mock import patch, AsyncMock
from app import app

client = TestClient(app)

def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}

@patch("app.run_analysis_with_agent", new_callable=AsyncMock)
def test_run_agent(mock_run):
    mock_run.return_value = {"agent_result": "Analysis complete"}
    
    payload = {
        "project_id": "proj-123",
        "days": 7,
        "pod": "dev"
    }
    response = client.post("/run-agent", json=payload)
    
    assert response.status_code == 200
    assert response.json() == {"agent_result": "Analysis complete"}
    
    mock_run.assert_called_once_with("proj-123", 7)

@patch("app.run_analysis_with_agent", new_callable=AsyncMock)
def test_run_agent_error(mock_run):
    mock_run.side_effect = Exception("Agent failed")
    
    payload = {"project_id": "proj-err"}
    response = client.post("/run-agent", json=payload)
    
    assert response.status_code == 500
    assert "agent error" in response.json()["detail"]
