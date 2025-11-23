const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

export const runAgent = async (projectId, days) => {
    const payload = {
        project_id: projectId.trim(),
        days: Number(days),
    };

    const res = await fetch(`${API_URL}/run-agent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`HTTP ${res.status} - ${errText || res.statusText}`);
    }

    return await res.json();
};
