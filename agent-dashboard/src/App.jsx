// src/App.jsx
import React from "react";
import Dashboard from "./components/Dashboard";

export default function App() {
  return (
    <div
      style={{
        fontFamily: "Inter, Arial, sans-serif",
        padding: 24,
        display: "flex",
        justifyContent: "center"
      }}
    >
      <div
        style={{
          width: "85%",
          margin: "0 auto"
        }}
      >
        <header className="container my-5 text-center" style={{ maxWidth: 1100 }}>
          <h1>Agent Dashboard</h1>
          <p style={{ color: "#666" }}>
            Enter the project and the number of days you want to check for cost anomalies.
            The Cloud Cost Agent will analyze the spend, highlight anomalies,
            identify root causes, suggest follow-up actions, and even create a ticket if needed.
          </p>
        </header>

        <Dashboard />
      </div>
    </div>
  );
}
