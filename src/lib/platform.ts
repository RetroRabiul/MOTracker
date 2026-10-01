import { Capacitor } from "@capacitor/core";

/** True when running inside the native Android shell rather than a browser. */
export const isNativeApp = Capacitor.isNativePlatform();

/**
 * Where a cold start lands. The native app skips the marketing landing page and
 * goes straight to the tracker; ProtectedRoute bounces signed-out users to /login.
 */
export const APP_HOME = isNativeApp ? "/dashboard" : "/";

/** Fallback for unknown routes, so the app never dead-ends on a marketing page. */
export const NOT_FOUND_ROUTE = isNativeApp ? "/dashboard" : "/";
