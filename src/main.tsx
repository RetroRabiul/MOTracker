import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { isNativeApp } from "./lib/platform";

const container = document.getElementById("root");
if (!container) {
  throw new Error('Root element #root was not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The service worker only makes sense for the installed web app. Inside the native
// shell the bundle ships with the APK, so precaching would only serve stale builds.
if (!isNativeApp && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .catch(() => {
        // Registration failures (private mode, blocked SW) must not break the app.
      });
  });
}
