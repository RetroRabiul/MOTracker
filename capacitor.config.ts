import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.expensetracker.app",
  appName: "ExpenseTracker",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
    // captureInput swaps in a BaseInputConnection, which has no Autofill support,
    // so password managers cannot offer suggestions. Keep the default keyboard.
    captureInput: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#2563eb",
      showSpinner: true,
      spinnerColor: "#ffffff",
    },
    // The app targets SDK 36, so Android 15+ lays the WebView out edge to edge.
    // SystemBars applies the insets natively and publishes them to CSS as
    // --safe-area-inset-*, which index.css consumes. `cover` is declared in the
    // viewport meta too; hinting it here avoids a first-frame layout shift while
    // the real value is still unknown.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
    },
    StatusBar: {
      // `backgroundColor` is ignored under enforced edge-to-edge, and a fixed
      // `style` would be wrong in one of the two themes, so both are driven at
      // runtime from the active dark-mode setting instead.
      overlaysWebView: true,
    },
  },
};

export default config;
