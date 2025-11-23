import logging
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from dotenv import load_dotenv

# Load env vars
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Cloud Cost Agent API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Example request shape
class AgentRequest(BaseModel):
    project_id: str
    days: int = 30

# Import after configuring logging/env
from agent_runner import run_analysis_with_agent

@app.post("/run-agent")
async def run_agent(req: AgentRequest):
    logger.info(f"Received request for project: {req.project_id}, days: {req.days}")
    try:
        res = await run_analysis_with_agent(req.project_id, req.days)
        return res
    except Exception as e:
        logger.error(f"Agent error: {e}")
        raise HTTPException(status_code=500, detail=f"agent error: {e}")

# Optional: simple health check
@app.get("/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    uvicorn.run("app:app", host="0.0.0.0", port=8080, log_level="info")
