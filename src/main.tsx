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
if ("serviceWorker" in navigator) {
  if (isNativeApp) {
    // Earlier builds registered one, so tear it down rather than just skipping setup.
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .then(() => caches.keys())
      .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
      .catch(() => {
        // Cache teardown is best-effort and must never break startup.
      });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Registration failures (private mode, blocked SW) must not break the app.
        });
    });
  }
}
