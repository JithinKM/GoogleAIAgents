// src/main.jsx
import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css"; // optional, create if you want styles

const root = createRoot(document.getElementById("root"));
root.render(<App />);
