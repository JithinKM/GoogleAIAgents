import React, { useEffect, useState } from "react";
import ModelChart from "./ModelChart";
import JsonBarChart from "./JsonBarChart";
import ProjectForm from "./ProjectForm";
import AgentResponse from "./AgentResponse";
import { runAgent } from "../services/api";
import { fetchAndParseCsv, getProjectOptions, computeTimeseriesForProject } from "../utils/dataProcessing";

export default function Dashboard() {
  const [projectId, setProjectId] = useState("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [agentResponse, setAgentResponse] = useState(null);
  const [error, setError] = useState(null);

  const [projectOptions, setProjectOptions] = useState([]);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError] = useState(null);
  const [csvRows, setCsvRows] = useState([]);
  const [csvMeta, setCsvMeta] = useState({});
  const [timeseries, setTimeseries] = useState(null);
  const [hidden, setHidden] = useState("d-none");
  const [agentHidden, setAgentHidden] = useState("d-none");

  useEffect(() => {
    const csvUrl = "/data/synthetic_billing.csv"; // public/data/synthetic_billing.csv
    setCsvLoading(true);
    setCsvError(null);

    fetchAndParseCsv(csvUrl)
      .then(({ rows, headers }) => {
        setCsvRows(rows);
        setCsvMeta({ headers });

        const options = getProjectOptions(rows);
        setProjectOptions(options);

        // Infer keys for later use
        const projectKey = "project_id";
        const dateKey = "usage_start_time";
        const costKey = "cost";
        setCsvMeta((m) => ({ ...m, projectKey, dateKey, costKey }));
      })
      .catch((err) => {
        console.error("CSV load error:", err);
        setCsvError(err.message || "Failed to load CSV");
      })
      .finally(() => setCsvLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setAgentResponse(null);
    setTimeseries(null);
    setHidden("d-none");
    setAgentHidden("d-none");

    if (!projectId.trim()) {
      setError("Project name is required.");
      return;
    }
    const daysNum = Number(days);
    if (!days || Number.isNaN(daysNum) || daysNum <= 0) {
      setError("Please enter a valid number of days (positive integer).");
      return;
    }

    setLoading(true);

    try {
      // compute timeseries client side from csvRows
      const { projectKey, dateKey, costKey } = csvMeta;
      const computed = computeTimeseriesForProject(csvRows, projectKey, dateKey, costKey, projectId, daysNum);

      if (computed?.error) {
        setError(computed.error);
        setLoading(false);
        return;
      }

      // computed.series is array [{x, y}, ...]
      const series = computed.series || [];
      setTimeseries(series);
      setHidden("");

      // Call API
      const data = await runAgent(projectId, daysNum);

      // show the text response in UI
      const text = (data?.agent_result ?? [])
        .flatMap(item => item?.content?.parts ?? [])
        .flatMap(part => typeof part?.text === "string" ? [part.text] : [])
        .join("\n\n");

      const response = text ? text : `No response from agent.`
      setAgentResponse(response);
      setAgentHidden("");
    } catch (err) {
      console.error(err);
      setError(err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-5 dashboard-container" id="mainContainer">
      <ProjectForm
        projectId={projectId}
        setProjectId={setProjectId}
        days={days}
        setDays={setDays}
        loading={loading}
        csvLoading={csvLoading}
        csvError={csvError}
        projectOptions={projectOptions}
        onSubmit={handleSubmit}
      />

      {/* Error */}
      {error && (
        <div className="alert alert-danger mt-3 py-2" role="alert">
          {error}
        </div>
      )}

      <div className="container chart-container text-center">
        <div className="row align-items-start">
          <div className="col">
            {/* Chart */}
            <section className={`mt-4 ${hidden}`}>
              <h5>Cost Analysis for the project: {projectId}</h5>
              <p className="text-muted small">Aggregated daily cost for the selected project and window.</p>
              <div className="p-3 rounded-3 border">
                <ModelChart timeseries={timeseries} />
              </div>
            </section>
          </div>
          <div className="col">
            <section className={`mt-4 ${hidden}`}>
              <h5>Resource Uage for the last {days} days</h5>
              <p className="text-muted small">Avg CPU util for the selected window.</p>
              <div className="p-3 rounded-3 border">
                <JsonBarChart days={Number(days) || 7} url="/data/synthetic_metrics.jsonl" />
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* Agent response */}
      <AgentResponse response={agentResponse} hidden={agentHidden} />
    </div>
  );
}
