// src/App.jsx
import React from "react";
import Dashboard from "./components/Dashboard";

export default function App() {
  return (
    <div className="app-container">
      <div className="app-content">
        {/*      <img
        src="/banner.png"
        alt="Dashboard Banner"
        style={{
          width: "100%",
          marginTop: "-250px",
          marginBottom: "24px",
          padding: "10px 20px",
          objectFit: "cover"
        }}
      />*/}
        <header className="container my-5 text-center header-container">
          <h1>Project Dashboard</h1>
          <p className="description">
            Select the project and the number of days you want to check for cost anomalies.
            The Cloud Cost Agent will analyze the spend, highlight anomalies,
            identify root causes, suggest follow-up actions, and even create a ticket if needed.
          </p>
        </header>

        <Dashboard />
      </div>
    </div>
  );
}
