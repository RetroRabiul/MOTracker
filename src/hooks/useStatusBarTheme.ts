import { useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { isNativeApp } from "../lib/platform";

/**
 * Keeps the native status bar legible in both themes.
 *
 * A fixed `StatusBar.style` in capacitor.config can only be right for one theme.
 * Under enforced edge-to-edge the bar is transparent and the app's own header
 * shows through, so the icon colour has to follow dark mode instead.
 */
export function useStatusBarTheme(darkMode: boolean): void {
  useEffect(() => {
    if (!isNativeApp) return;

    // `Style.Dark` = light icons, for a dark header background.
    void StatusBar.setStyle({ style: darkMode ? Style.Dark : Style.Light }).catch(() => {
      // A missing platform implementation must not break the render.
    });
  }, [darkMode]);
}
