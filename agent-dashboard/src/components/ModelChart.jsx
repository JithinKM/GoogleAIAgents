// src/components/ModelChart.jsx
import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
} from "chart.js";
// If you want time scale parsing, you'll need chartjs-adapter-date-fns or luxon
// import 'chartjs-adapter-date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

export default function ModelChart({ timeseries = [] }) {
  // Ensure we always receive a fresh array — prevents mutation issues upstream
  const series = Array.isArray(timeseries) ? [...timeseries] : [];

  // derive labels and numeric values
  const labels = series.map((p) => p.x ?? "");
  const values = series.map((p) => (Number.isFinite(p.y) ? p.y : Number(p.y) || 0));

  const labelKey = labels.join("|");
  const valueKey = values.join(",");

  // memoize data/options so chartjs-2 updates correctly when deps change
  const data = useMemo(() => ({
    labels,
    datasets: [
      {
        label: "Daily cost",
        data: values,
        borderColor: "#4f46e5",         // deep indigo
        backgroundColor: "rgba(79, 70, 229, 0.2)",
        pointBackgroundColor: "#06b6d4", // aqua
        pointBorderColor: "#06b6d4",
        tension: 0.3,
        borderWidth: 2,
        pointRadius: 4,
      }
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [labelKey, valueKey]); // join used to create stable primitive deps

  const options = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: {
        ticks: { maxRotation: 45, minRotation: 0 },
      },
      y: {
        beginAtZero: true
      }
    },
    plugins: {
      legend: { position: "top" },
      tooltip: { mode: "index", intersect: false }
    }
  }), []);

  return (
    <div className="chart-wrapper">
      <Line data={data} options={options} />
    </div>
  );
}
