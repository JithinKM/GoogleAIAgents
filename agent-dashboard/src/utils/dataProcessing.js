import Papa from "papaparse";

export const tryParseDate = (value) => {
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

export const fetchAndParseCsv = async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load CSV: ${res.status}`);
    const csvText = await res.text();
    const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
    return {
        rows: parsed.data || [],
        headers: parsed.meta?.fields || [],
    };
};

export const getProjectOptions = (rows, projectKey = "project_id") => {
    const set = new Set();
    for (const r of rows) {
        const val = (r[projectKey] ?? "").toString().trim();
        if (val) set.add(val);
    }
    const options = Array.from(set);
    options.sort();
    return options;
};

export const computeTimeseriesForProject = (rows, projectKey, dateKey, costKey, projectValue, daysBack) => {
    if (!rows || rows.length === 0) return { series: [] };

    // determine cutoff: use today's date as end, subtract daysBack-1 to include today
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setUTCDate(cutoff.getUTCDate() - (daysBack - 1)); // include today as 1
    cutoff.setUTCHours(0, 0, 0, 0);

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
    endDate.setUTCHours(0, 0, 0, 0);

    while (dateCursor <= endDate) {
        const key = dateCursor.toISOString().slice(0, 10);
        out.push({ x: key, y: Math.round((agg.get(key) || 0) * 100) / 100 }); // round cents
        dateCursor.setUTCDate(dateCursor.getUTCDate() + 1);
    }

    return { series: out, usedKeys: { inferredDateKey, inferredCostKey } };
};
