import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

/* «Ловушка ошибок»: если приложение упадёт при загрузке, вместо белого
   экрана пользователь увидит понятное сообщение и сможет прислать его текст. */
class BootErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0e1411", padding: 24 }}>
          <div style={{ maxWidth: 560, width: "100%", background: "#151c18", border: "1px solid #303b34", borderRadius: 14, padding: 28, color: "#e7ece7", fontFamily: "Manrope, sans-serif" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 22 }}>⚠️</span>
              <strong style={{ fontSize: 16 }}>Не удалось запустить ПРО CRM</strong>
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: "#93a096", margin: "0 0 14px" }}>
              Произошла ошибка при загрузке. Скопируйте текст ниже и отправьте его разработчику — по нему он быстро поймёт причину.
            </p>
            <pre style={{ background: "#0e1411", border: "1px solid #242e28", borderRadius: 10, padding: 14, fontSize: 11.5, lineHeight: 1.5, color: "#ff8a7a", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 220, overflow: "auto", margin: 0 }}>
              {String(this.state.error?.message ?? this.state.error)}
              {this.state.error?.stack ? "\n\n" + this.state.error.stack : ""}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ marginTop: 16, background: "#17705c", color: "#f6faf7", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
            >
              Попробовать ещё раз
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <BootErrorBoundary>
    <App />
  </BootErrorBoundary>
);
