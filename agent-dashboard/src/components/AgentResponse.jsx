import React from "react";
import ReactMarkdown from "react-markdown";

export default function AgentResponse({ response, hidden }) {
    return (
        <div className="container chart-container">
            <section className={`mt-4 ${hidden}`}>
                <h5>Cost Anomalies Detected</h5>
                <div className="p-3 rounded-3 border markdown-content">
                    <ReactMarkdown>
                        {
                            typeof response === "string" ? response : "No response yet — submit the form to run the agent."
                        }
                    </ReactMarkdown>
                </div>
            </section>
        </div>
    );
}
