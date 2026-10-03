import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { BarChart3, Home, List, Plus, Settings, type LucideIcon } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

/**
 * Mobile tab bar.
 *
 * The desktop layout drives navigation from the dashboard cards and per-page
 * back buttons. On a phone that means every section change is a round trip
 * through the dashboard, so the primary destinations get a fixed tab bar
 * instead. It is hidden from `md` up, where the full-width headers take over.
 */
interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Rendered as a filled action button in the middle of the bar. */
  primary?: boolean;
}

const TABS: Tab[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/expenses", label: "History", icon: List },
  { to: "/add-data", label: "Add", icon: Plus, primary: true },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

/** Routes where the tab bar is meaningful. Auth and marketing pages opt out. */
const APP_ROUTES = [
  "/dashboard",
  "/expenses",
  "/add-data",
  "/analytics",
  "/settings",
  "/export",
];

function isAppRoute(pathname: string): boolean {
  return APP_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/**
 * The soft keyboard shrinks the visual viewport but not `window.innerHeight`, so
 * a `position: fixed` bar that ignores this ends up stranded above the keyboard
 * and hiding the form field the user is typing into.
 */
function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const update = () => {
      // Roughly the height of a keyboard; small deltas are the URL bar.
      setOpen(window.innerHeight - viewport.height > 150);
    };

    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);

  return open;
}

export default function BottomNav() {
  const { colors, darkMode } = useTheme();
  const { pathname } = useLocation();
  const keyboardOpen = useKeyboardOpen();

  if (!isAppRoute(pathname) || keyboardOpen) return null;

  return (
    <nav
      aria-label="Primary"
      className={`fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur md:hidden ${
        darkMode ? "border-slate-800 bg-slate-900/95" : "border-gray-200 bg-white/95"
      }`}
      style={{ paddingBottom: "var(--sab)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map(({ to, label, icon: Icon, primary }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              aria-label={label}
              className={({ isActive }) =>
                `relative flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 pt-1.5 pb-1 text-xs font-medium transition ${
                  isActive
                    ? "font-semibold"
                    : darkMode
                      ? "text-gray-400"
                      : "text-gray-500"
                }`
              }
              style={({ isActive }) => (isActive ? { color: colors.primary } : undefined)}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 top-0 h-0.5 rounded-full"
                      style={{ backgroundColor: colors.primary }}
                    />
                  )}
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${
                      primary ? "text-white" : ""
                    }`}
                    style={primary ? { backgroundColor: colors.primary } : undefined}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                  {/* Screen readers announce the active tab via aria-current on NavLink. */}
                  {isActive && <span className="sr-only">(current)</span>}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
