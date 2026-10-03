import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.expensetracker.app",
  appName: "MOTracker",
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
      // The Capacitor plugin paints its own window over the Android system
      // splash, so it needs a colour of its own. Matched to the middle stop of
      // the gradient in @drawable/splash so the hand-off does not shift hue.
      //
      // Pointing `androidSplashResourceName` at the splash drawable was tried
      // and reverted: on this device it resolved to a black window rather than
      // the layer-list. The icon is supplied to the system splash via
      // windowSplashScreenAnimatedIcon in styles.xml instead.
      backgroundColor: "#6d28d9",
      // The mark is already shown by the system splash; a spinner on top of it
      // read as two competing pieces of loading UI.
      showSpinner: false,
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
