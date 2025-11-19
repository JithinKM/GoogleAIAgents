// src/components/ModelChart.jsx
import React from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function ModelChart() {
  // If your API returned timeseries and we saved it on window.__latestTimeseries, use it.
  const ts = window.__latestTimeseries ?? [
    // fallback demo data
    { x: "Day 1", y: 10 },
    { x: "Day 2", y: 12 },
    { x: "Day 3", y: 9 },
    { x: "Day 4", y: 15 }
  ];

  const labels = ts.map(p => p.x);
  const data = {
    labels,
    datasets: [
      {
        label: "Metric",
        data: ts.map(p => p.y),
        fill: false,
        tension: 0.25,
        pointRadius: 4
      }
    ]
  };

  const options = {
    responsive: true,
    plugins: {
      legend: { position: "top" },
      title: { display: false, text: "Model timeseries" }
    }
  };

  return <div style={{maxWidth:800}}><Line data={data} options={options} /></div>;
}
