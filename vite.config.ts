import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    // The Settings download button is only rendered when a published APK is
    // actually part of this build.
    __APK_PUBLISHED__: JSON.stringify(
      existsSync(fileURLToPath(new URL("./public/app.apk", import.meta.url))),
    ),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // `autoUpdate` calls skipWaiting + clientsClaim, so a deploy swaps the
      // bundle mid-session and discards unsaved form state. `prompt` lets the
      // user choose when to take the update.
      registerType: "prompt",
      // Registration is done manually in src/main.tsx so the native shell can skip it.
      injectRegister: null,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "ExpenseTracker",
        short_name: "Expenses",
        description: "Track business expenses, capture receipts, and export reports",
        theme_color: "#2563eb",
        background_color: "#f9fafb",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/",
        icons: [
          {
            src: "pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Assets already listed in `includeAssets` are picked up by globPatterns,
        // so listing both precached the icons twice.
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
        globIgnores: ["**/app.apk", "**/app-debug.apk"],
        // Serve the precached shell for navigations explicitly rather than relying on the
        // implicit html-precache route, so deep links behave the same on every deploy.
        navigateFallback: "index.html",
        // No runtimeCaching: the only remote data is authenticated Supabase traffic
        // and FX rates, neither of which may be served from a cache. The app is
        // therefore offline-read-incapable by design - only the shell is precached.
      },
    }),
  ],
});
