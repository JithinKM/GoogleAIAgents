import React from "react";

export default function ProjectForm({
    projectId,
    setProjectId,
    days,
    setDays,
    loading,
    csvLoading,
    csvError,
    projectOptions,
    onSubmit
}) {
    return (
        <form onSubmit={onSubmit} className="row g-3 align-items-end">
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
    );
}
