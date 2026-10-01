import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RefreshCw, X } from "lucide-react";
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

/**
 * The service worker only makes sense for the installed web app. Inside the native
 * shell the bundle ships with the APK, so precaching would only serve stale builds.
 */
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

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
    return;
  }

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    } catch {
      // Registration failures (private mode, blocked SW) must not break the app.
    }
  });
}

registerServiceWorker();

/**
 * With `registerType: "prompt"` a new deploy waits in the background, so a
 * reload used to silently drop a half-filled form. This offers the update
 * explicitly instead.
 */
function UpdatePrompt() {
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (isNativeApp || !("serviceWorker" in navigator)) return;

    let cancelled = false;

    const track = async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (!cancelled && reg) setRegistration(reg);

      reg?.addEventListener("updatefound", () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          // A worker that reaches "installed" while another controls the page is
          // an update waiting to be applied.
          if (!cancelled && installing.state === "installed" && navigator.serviceWorker.controller) {
            setRegistration(reg);
          }
        });
      });
    };

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    void track();

    return () => {
      cancelled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!registration || dismissed) return null;

  return (
    <div className="fixed inset-x-3 bottom-3 z-50 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-lg sm:inset-x-auto sm:right-5 sm:bottom-5 sm:max-w-sm">
      <p className="flex-1 text-sm text-gray-700">A new version is ready to install.</p>
      <button
        type="button"
        onClick={() => {
          setDismissed(true);
          void registration.waiting?.postMessage({ type: "SKIP_WAITING" });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-blue-700"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Update
      </button>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss update notice"
        className="rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

if (!isNativeApp) {
  const updateHost = document.createElement("div");
  updateHost.id = "sw-update-root";
  document.body.appendChild(updateHost);
  createRoot(updateHost).render(
    <StrictMode>
      <UpdatePrompt />
    </StrictMode>,
  );
}
