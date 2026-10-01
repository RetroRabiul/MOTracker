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
    StatusBar: {
      style: "LIGHT",
      backgroundColor: "#2563eb",
    },
  },
};

export default config;
