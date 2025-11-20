# Cloud Cost Anomaly Detection & Automated Ticketing Agent

Cloud costs are notoriously unpredictable. Teams often realize a spike after the bill arrives — sometimes days or weeks later — which is too late to act. Even small inefficiencies or a single runaway job can cause massive budget overruns.

Three things make this problem particularly salty:
Anomalies hide inside huge daily billing logs
Metrics and billing live in different systems
No one manually monitors dashboards 24/7
I wanted to build something that can continuously monitor, detect, explain, and take action whenever cloud spending increases unexpectedly. This is a classic FinOps problem, and also one of the best real-world scenarios for intelligent agents.

## Why agents?
Traditional monitoring rules are rigid, noisy, and don’t scale.
Agents, on the other hand:

Analyze structured + unstructured signals (billing, metrics, logs)
Call tools sequentially (billing query → anomaly detector → metrics → ticket)
Delegate tasks to a sub-agent specialized in spike detection
Take actions like creating tickets or recommending remediation steps
Operate autonomously, making them ideal for continuous monitoring
By combining a main reasoning agent with a specialized spike detector agent and tool integrations, the system becomes dynamic, explainable, and way more flexible than handcrafted rules or dashboards.

## What I created
The project is a multi-agent cloud cost anomaly detection system built using Google ADK and synthetic billing + metric datasets.

## Core Components:

- cloud_cost_agent (Main orchestrator)
Sends billing time window to spike detector
Calls the CPU monitoring tool
Correlates anomalies with workload behavior
Creates tickets when spikes are confirmed
Returns JSON with spike summary + explanation + remediation steps
- spike_detector_agent (Sub-agent embedded via AgentTool)
Receives only the JSON rows for the last N days
Returns strict JSON:
{ "spikes": […], "reason": "…" }

- Custom Tools
  -  Billing Query Tool (bq_query_cost_by_project)
  -  Monitoring Metrics Tool (monitoring_fetch_cpu)
  -  Ticketing Tool (ticket_create)
  -  AgentTool wrapper for the sub-agent
  -  Synthetic Data Generators

365 days × 30 projects
Weekly/monthly seasonality
Batch spikes, release spikes, and random incidents
CPU patterns aligned with billing anomalies
The multi-agent setup enables each component to perform its job efficiently, while the orchestration resembles a real cloud FinOps pipeline.

## Multi-Agent System
cloud_cost_agent + spike_detector_agent
(sub-agent embedded as a tool using AgentTool)
Custom Tools
Billing, metrics, ticketing — all Python-backed, ADK-compatible
Sequential Orchestration
Main agent → spike detector → metrics → ticket → explanation
Synthetic Dataset Pipeline
Realistic costs + correlated CPU anomalies
100% local and reproducible
Visualization (matplotlib)
Clear time-series charts for cost & CPU
InMemoryRunner
Clean debugging and replay support

## The stack:
- Google ADK
- Gemini 2.5 Flash Lite
- Matplotlib
- Pandas
- Kaggle Notebook for execution
