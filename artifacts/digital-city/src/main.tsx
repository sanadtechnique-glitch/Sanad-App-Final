import { createRoot } from "react-dom/client";
import { Component, type ReactNode } from "react";
import { setBaseUrl } from "@workspace/api-client-react";
import App from "./App";
import "./index.css";

setBaseUrl("/api");

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) {
    return { error: e.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
          <div style={{ background: "#1a1a1a", border: "1px solid #D4AF37", borderRadius: "1rem", padding: "2rem", maxWidth: "600px", color: "#fff", fontFamily: "monospace" }}>
            <h2 style={{ color: "#D4AF37", marginBottom: "1rem" }}>⚠️ خطأ في التطبيق / App Error</h2>
            <pre style={{ color: "#f87171", whiteSpace: "pre-wrap", fontSize: "0.85rem" }}>{this.state.error}</pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById("root");
if (container) {
  createRoot(container).render(
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
} else {
  document.body.innerHTML = '<div style="color:red;padding:2rem">ERROR: #root element not found in index.html</div>';
}
