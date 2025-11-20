import React, { useEffect, useState, useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

/**
 * Props:
 *  - days: number (last N days to include, default 7)
 *  - url: path to JSONL file (default: /data/metrics.jsonl)
 *  - instanceFilter: optional array of instance names to include (defaults to all found)
 */
export default function JsonBarChart({days, url, instanceFilter = null}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // fetch and parse jsonl
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load JSONL: ${r.status}`);
        return r.text();
      })
      .then((text) => {
        if (!mounted) return;
        const lines = text
          .split(/\r?\n/)
          .map((l) => l.trim())
          .filter(Boolean);
        const parsed = [];
        for (const line of lines) {
          try {
            const obj = JSON.parse(line);
            parsed.push(obj);
          } catch (err) {
            // ignore invalid JSON lines but log for dev
            console.warn("Invalid JSONL line skipped:", line, err);
          }
        }
        setRows(parsed);
      })
      .catch((err) => {
        console.error(err);
        if (mounted) setError(err.message || "Failed to load");
      })
      .finally(() => mounted && setLoading(false));
    return () => { mounted = false; };
  }, [url]);

  // compute cutoff range based on days only (inclusive of today)
  const { fromDate, toDate } = useMemo(() => {
    const to = new Date();
    to.setHours(23, 59, 59, 999);

    const from = new Date(to);
    const d = Math.max(1, Number(days) || 7);
    from.setDate(from.getDate() - (d - 1)); // include today as 1
    from.setHours(0, 0, 0, 0);

    return { fromDate: from, toDate: to };
  }, [days]);

  // aggregate average cpu per instance within the window
  const aggregated = useMemo(() => {
    if (!rows || rows.length === 0) return { series: [] };

    const map = new Map(); // instance -> { sum, count }
    for (const r of rows) {
      if (!r.timestamp || !r.instance) continue;
      const d = new Date(r.timestamp);
      if (Number.isNaN(d.getTime())) continue;
      if (d < fromDate || d > toDate) continue;

      const inst = String(r.instance);
      const cpu = Number(r.cpu_util ?? r.cpu ?? r.util ?? NaN);
      if (Number.isNaN(cpu)) continue;

      const cur = map.get(inst) ?? { sum: 0, count: 0 };
      cur.sum += cpu;
      cur.count += 1;
      map.set(inst, cur);
    }

    // get instance list; if instanceFilter given, use that order
    const allInstances = Array.from(map.keys()).sort();
    const finalInstances = Array.isArray(instanceFilter) && instanceFilter.length > 0
      ? instanceFilter.filter((i) => map.has(i))
      : allInstances;

    const series = finalInstances.map((inst) => {
      const { sum, count } = map.get(inst) ?? { sum: 0, count: 0 };
      const avg = count > 0 ? sum / count : 0;
      return { instance: inst, avg: Math.round(avg * 100) / 100, count };
    });

    return { series };
  }, [rows, fromDate, toDate, instanceFilter]);

  // build chart data and colors
  const data = useMemo(() => {
    const series = aggregated.series ?? [];
    const labels = series.map((s) => s.instance);
    const values = series.map((s) => s.avg);

    const palette = ["#4f46e5","#06b6d4","#10b981","#f59e0b","#ec4899","#8b5cf6"];

    const hexToRgba = (hex, a=0.85) => {
      const h = hex.replace("#", "");
      const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
      const bigint = parseInt(full, 16);
      const r = (bigint >> 16) & 255;
      const g = (bigint >> 8) & 255;
      const b = bigint & 255;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    };

    const borderColor = values.map((_, idx) => hexToRgba(palette[idx % palette.length], 1));
    const backgroundColor = values.map((_, idx) => hexToRgba(palette[idx % palette.length], 0.18));

    return {
      labels,
      datasets: [
        {
          label: `Avg CPU util (${fromDate.toISOString().slice(0,10)} → ${toDate.toISOString().slice(0,10)})`,
          data: values,
          backgroundColor,
          borderColor,
          borderWidth: 1.5,
        }
      ]
    };
  }, [aggregated, fromDate, toDate]);

  const options = useMemo(() => ({
    indexAxis: 'x',
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Avg CPU %' } },
      x: { title: { display: true, text: 'Instance' } }
    },
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: {
        label: (context) => `${context.parsed.y}%`
      }}
    }
  }), []);

  if (loading) return <div>Loading metrics…</div>;
  if (error) return <div className="text-danger">Error: {error}</div>;
  if (!aggregated.series || aggregated.series.length === 0) return <div className="text-muted">No metric data found for the selected window.</div>;

  return (
    <div style={{ width: "100%", height: 360 }}>
      <Bar data={data} options={options} />
    </div>
  );
}
