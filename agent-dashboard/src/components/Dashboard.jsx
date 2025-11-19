// src/components/Dashboard.jsx
import React, { useEffect, useState } from "react";
import Papa from "papaparse";
// import ModelChart from "./ModelChart";

export default function Dashboard() {
  const [projectId, setProjectId] = useState("");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [agentResponse, setAgentResponse] = useState(null);
  const [error, setError] = useState(null);

  const [projectOptions, setProjectOptions] = useState([]);
  const [csvLoading, setCsvLoading] = useState(true);
  const [csvError, setCsvError] = useState(null);

  // Change this to your actual URL if different
  const API_URL = "http://localhost:8080/run-agent";

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

        // detect which key exists in the header
        const headerKeys = parsed.meta?.fields ?? [];

        // collect unique, non-empty values
        const set = new Set();
        for (const r of rows) {
          const val = (r["project_id"] ?? "").toString().trim();
          if (val) set.add(val);
        }

        const options = Array.from(set);
        options.sort(); // alphabetical

        setProjectOptions(options);
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
      setAgentResponse(text);

      // optionally: if your API returns timeseries, pass to chart
      // we assume timeseries is [{x: "2025-11-19", y: 123}, ...]
      if (data?.timeseries) {
        // pass timeseries to chart via state or context — for simplicity we set a window.temp
        window.__latestTimeseries = data.timeseries;
      } else {
        window.__latestTimeseries = null;
      }
    } catch (err) {
      console.error(err);
      setError(err?.message ?? "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container my-5" style={{ maxWidth: 1100 }}>
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
            className="btn btn-primary"
            disabled={loading || csvLoading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Running...
              </>
            ) : (
              "Submit"
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

      {/* Agent response */}
      <section className="mt-4">
        <h5>Agent response</h5>
        <div className="p-3 rounded-3 border" style={{ background: "#f7f7f7", minHeight: 80, whiteSpace: "pre-wrap" }}>
          {agentResponse ?? "No response yet — submit the form to run the agent."}
        </div>
      </section>

      {/* Optional Chart area (commented out in your original) */}
      {/*
      <section className="mt-4">
        <h5>Chart (demo)</h5>
        <p className="text-muted small">This demo chart shows how you could plot timeseries returned by your API.</p>
        <ModelChart />
      </section>
      */}
    </div>
  );
}
