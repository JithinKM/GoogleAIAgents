# Cloud Cost Anomaly Detection & Automated Ticketing Agent

<img width="1080" height="608" alt="image" src="https://github.com/user-attachments/assets/ed2762f4-f785-49ed-9c7f-cc1633001f67" />

Cloud costs are notoriously unpredictable. Teams often realize a spike after the bill arrives — sometimes days or weeks later — which is too late to act. Even small inefficiencies or a single runaway job can cause massive budget overruns.

Three things make this problem particularly salty:
Anomalies hide inside huge daily billing logs
Metrics and billing live in different systems
No one manually monitors dashboards 24/7
I wanted to build something that can continuously monitor, detect, explain, and take action whenever cloud spending increases unexpectedly. This is a classic FinOps problem, and also one of the best real-world scenarios for intelligent agents.
<img width="2224" height="1231" alt="image" src="https://github.com/user-attachments/assets/1f1d74ea-ec76-4c99-85ea-d990d11f9da9" />

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
<img width="1280" height="720" alt="image" src="https://github.com/user-attachments/assets/297d7651-6d94-4f99-8a8c-a98c88fd5e56" />

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

## The stack:
- Google ADK
- Gemini 2.5 Flash Lite
- Matplotlib
- Pandas

<img width="2191" height="1229" alt="image" src="https://github.com/user-attachments/assets/c2f764cb-389f-41d4-bb35-32a78efc9a01" />
