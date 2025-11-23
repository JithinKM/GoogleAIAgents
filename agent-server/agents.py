import os
import logging
from google.adk.agents import LlmAgent
from google.adk.models.google_llm import Gemini
from google.adk.tools import AgentTool
from google.genai import types
from dotenv import load_dotenv
import tools

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Global agent instances
root_cause_agent = None
spike_detector_agent = None
cloud_cost_agent = None

def build_cloud_cost_agent():
    global root_cause_agent
    global spike_detector_agent
    global cloud_cost_agent

    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        logger.error("GOOGLE_API_KEY not found in environment variables.")
        # We might want to raise an error or let the SDK fail later, but logging is good.
    else:
        # Ensure it's set in os.environ for the SDK if needed, though usually SDK reads env var directly
        # or we pass it. The original code set os.environ.
        os.environ["GOOGLE_API_KEY"] = api_key

    retry_config = types.HttpRetryOptions(
        attempts=5,  # Maximum retry attempts
        exp_base=7,  # Delay multiplier
        initial_delay=1,
        http_status_codes=[429, 500, 503, 504],  # Retry on these HTTP errors
    )

    # model choice — keep same as your original sample
    model = Gemini(model="gemini-2.5-flash-lite", retry_options=retry_config)

    if root_cause_agent is None:
        root_cause_agent = LlmAgent(
            name="root_cause_agent",
            model=model,
            instruction=(
                "You are a Root Cause Analyzer. INPUT: JSON object with keys: 'project_id', 'spikes', 'recent_metrics'.\n\n"
                "TASK: Return ONLY a JSON object with keys: {\"root_causes\": [{\"cause\":\"...\", \"confidence\":0.0, \"evidence\":\"...\"}], \"recommendation\":\"short text\" }\n\n"
                "Constraints: Output must be valid JSON, no extra prose. Provide at least one cause if spikes are non-empty."
            )
        )

    if spike_detector_agent is None:
        spike_detector_agent = LlmAgent(
            name="spike_detector_agent",
            model=model,
            instruction=(
                "You are a Spike Detector agent. INPUT: JSON array named 'rows' containing objects "
                "with at least 'usage_start_time' and 'cost'.\n\n"
                "TASK: Return a single JSON object ONLY (no prose) with keys:\n"
                "  {\"spikes\": [<rows that are spikes>], \"reason\": \"root cause of the spikes\"}\n\n"
                "Constraints: Output MUST be valid JSON. The 'spikes' list should contain the original "
                "row objects (or objects with usage_start_time and cost). If none, return spikes: [] and reason: 'none'."
            )
        )

    if cloud_cost_agent is None:
        cloud_cost_agent = LlmAgent(
            name="cloud_cost_agent",
            model=model,
            instruction=(
                "You are cloud_cost_agent_ext. You will be given a JSON payload with billing rows and recent metrics.\n\n"
                "RULES (read carefully):\n"
                " - Use the exact tool names provided in the agent's tools list.\n"
                " - When calling a tool, issue a single function_call with VALID JSON arguments only (no markdown/backticks).\n"
                " - **Do not finish** immediately after any single tool responds. After a tool returns, CONTINUE reasoning and call the next tool(s) as needed.\n"
                " - Your session should follow this explicit multi-step workflow:\n"
                "     1) CALL spike_detector_agent with {\"rows\": billing_rows_for_detector}. Wait for its response.\n"
                "     2) If there are spikes, CALL root_cause_agent with {\"project_id\":..., \"spikes\":<the spikes returned>, \"recent_metrics\": recent_metrics_sample} and wait for its response.\n"
                "     3) If spikes exist, CALL ticket_create tool with a JSON payload {\"title\":..., \"body\":...} and wait for its response.\n"
                "     4) CALL forecast_costs tool with a JSON payload {\"rows\": billing_rows_for_detector}. Wait for its response.\n"
                " - After all required tool calls and responses, produce a FINAL response in plain English.\n\n"
                "Always follow the workflow above and always return the FINAL result at the end."
            ),
            tools=[
                tools.bq_query_cost_by_project,
                tools.monitoring_fetch_cpu,
                AgentTool(agent=spike_detector_agent),
                AgentTool(agent=root_cause_agent),
                tools.ticket_create,
                tools.forecast_costs
            ]
        )
        logger.info("------------- cloud_cost_agent created -------------")

    return cloud_cost_agent
