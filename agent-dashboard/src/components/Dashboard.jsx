// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import ReactMarkdown from "react-markdown";
import ModelChart from "./ModelChart";
import JsonBarChart from "./JsonBarChart";

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

  // Change this to your actual URL if different
  const API_URL = "http://localhost:8080/run-agent";

  const tryParseDate = (value) => {
    if (!value) return null;
    // try ISO first
    const d1 = new Date(value);
    if (!Number.isNaN(d1.getTime())) return d1;
    // try numeric epoch seconds/millis
    const n = Number(value);
    if (!Number.isNaN(n)) {
      // heuristic: >1e12 -> millis, >1e9 -> seconds
      if (n > 1e12) return new Date(n);
      if (n > 1e9) return new Date(n * 1000);
    }
    // try common slash format dd/mm/yyyy or mm/dd/yyyy guesses
    // fallback: Date.parse
    const d2 = Date.parse(value);
    if (!Number.isNaN(d2)) return new Date(d2);
    return null;
  };

  useEffect(() => {
    const csvUrl = "/data/synthetic_billing.csv"; // public/data/synthetic_billing.csv
    setCsvLoading(true);
    setCsvError(null);

    fetch(csvUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`);
        return res.text();
      })
      .then((csvText) => {
        const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
        // parsed.data is an array of objects keyed by CSV header
        const rows = parsed.data || [];
        const headers = parsed.meta?.fields || [];
        setCsvRows(rows);
        setCsvMeta({ headers, parsed });

        const projectKey = "project_id";
        const dateKey = "usage_start_time";
        const costKey = "cost";
        // collect unique, non-empty values
        const set = new Set();
        for (const r of rows) {
          const val = (r[projectKey] ?? "").toString().trim();
          if (val) set.add(val);
        }

        const options = Array.from(set);
        options.sort(); // alphabetical

        setProjectOptions(options);
        setCsvMeta((m) => ({ ...m, projectKey, dateKey, costKey }));
      })
      .catch((err) => {
        console.error("CSV load error:", err);
        setCsvError(err.message || "Failed to load CSV");
      })
      .finally(() => setCsvLoading(false));
  }, []);

  // helper: aggregate costs per day for selected project and last N days
  const computeTimeseriesForProject = (rows, projectKey, dateKey, costKey, projectValue, daysBack) => {
    if (!rows || rows.length === 0) return [];

    // determine cutoff: use today's date as end, subtract daysBack-1 to include today
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - (daysBack - 1)); // include today as 1
    cutoff.setHours(0, 0, 0, 0);

    // if dateKey not found, try to infer by looking for any column that parses to date
    const inferredDateKey = dateKey || Object.keys(rows[0]).find((k) => tryParseDate(rows[0][k]) !== null);

    // cost key fallback: try any numeric column
    let inferredCostKey = costKey;
    if (!inferredCostKey) {
      const sample = rows[0] || {};
      inferredCostKey = Object.keys(sample).find((k) => {
        const v = sample[k];
        return v !== "" && !Number.isNaN(Number(v));
      });
    }

    if (!inferredDateKey || !inferredCostKey) {
      // not enough info to compute timeseries
      return { error: "Could not detect date or cost column in CSV" };
    }

    // filter rows by project (if projectKey missing, try any first column match)
    const filtered = rows.filter((r) => {
      const projVal = projectKey ? (r[projectKey] ?? "").toString().trim() : Object.values(r)[0] ?? "";
      if (projVal !== (projectValue ?? "")) return false;
      const d = tryParseDate(r[inferredDateKey]);
      return d && d >= cutoff;
    });

    // aggregate by yyyy-mm-dd
    const agg = new Map();
    for (const r of filtered) {
      const d = tryParseDate(r[inferredDateKey]);
      if (!d) continue;
      const dayKey = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const costVal = Number(r[inferredCostKey]) || 0;
      agg.set(dayKey, (agg.get(dayKey) || 0) + costVal);
    }

    // ensure we have entries for each date from cutoff to today (fill with 0)
    const out = [];
    const dateCursor = new Date(cutoff);
    const endDate = new Date();
    endDate.setHours(0, 0, 0, 0);

    while (dateCursor <= endDate) {
      const key = dateCursor.toISOString().slice(0, 10);
      out.push({ x: key, y: Math.round((agg.get(key) || 0) * 100) / 100 }); // round cents
      dateCursor.setDate(dateCursor.getDate() + 1);
    }

    return { series: out, usedKeys: { inferredDateKey, inferredCostKey } };
  };

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
      // console.log("------series-------");
      // console.log(series)
      // set chart data
      setTimeseries(series);
      setHidden("");


      // Example using fetch. If you want axios, swap with axios.post(...)
      const payload = {
        project_id: projectId.trim(),
        days: daysNum
      };

      const res = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
          // add Authorization header here if your API needs it
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // read error body if available
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errText || res.statusText}`);
      }

      // assume the API returns JSON like { message: "...", timeseries: [...] }
      const data = await res.json();

      // show the text response in UI
      // we tolerate multiple shapes — try to extract message or fallback to raw
      const text =
        data?.agent_result
          ?.flatMap(item =>
            item?.content?.parts
              ?.filter(part => typeof part?.text === "string")
              ?.map(part => part.text)
              ?? []
          ) ?? [];
      // console.log("------Agent response:-------");
      // console.log(text);
      // console.log("-------------");
      const response = text[0]? text[0] : "No cost anomalies detected for the project ${project_id} for the past ${days} days."
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
    <div className="container my-5" id="mainContainer" style={{ maxWidth: 1100 }}>
      <form onSubmit={handleSubmit} className="row g-3 align-items-end">
        {/* Project dropdown */}
        <div className="col-12 col-md-6">
          <label className="form-label small">Project</label>

          {csvLoading ? (
            <div className="d-flex align-items-center">
              <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></div>
              <small>Loading projects from CSV…</small>
            </div>
          ) : csvError ? (
            <div className="text-danger small">CSV Error: {csvError}</div>
          ) : projectOptions.length === 0 ? (
            <div className="small text-muted">No projects found in CSV</div>
          ) : (
            <select
              className="form-select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              aria-label="Select project"
            >
              <option value="" disabled>Select a project</option>
              {projectOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
        </div>

        {/* Days input */}
        <div className="col-6 col-md-3">
          <label className="form-label small">No. of days</label>
          <input
            type="number"
            className="form-control"
            placeholder="No. of days"
            value={days}
            onChange={(e) => setDays(e.target.value)}
            min="1"
            max="365"
          />
        </div>

        {/* Submit button */}
        <div className="col-6 col-md-3 d-grid">
          <button
            type="submit"
            className="btn ai-btn"
            disabled={loading || csvLoading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Running...
              </>
            ) : (
              "Ask Agent"
            )}
          </button>
        </div>
      </form>

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
      <div className="container chart-container">
        <section className={`mt-4 ${agentHidden}`}>
          <h5>Cost Anomalies Detected</h5>
          <div className="p-3 rounded-3 border">
            <ReactMarkdown>
                {
                  typeof agentResponse === "string"? agentResponse : "No response yet — submit the form to run the agent."
                }
              </ReactMarkdown>
          </div>
        </section>
      </div>
    </div>
  );
}
