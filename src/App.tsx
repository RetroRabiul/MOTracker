import { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, RESET_PASSWORD_PATH } from "./context/AuthContext";
import { ThemeProvider, useTheme } from "./context/ThemeContext";
import { SettingsProvider } from "./context/SettingsContext";
import ProtectedRoute, { PublicRoute } from "./components/ProtectedRoute";
import BottomNav from "./components/BottomNav";
import { useStatusBarTheme } from "./hooks/useStatusBarTheme";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import AddData from "./pages/AddData";
import EditTransaction from "./pages/EditTransaction";
import ExpenseList from "./pages/ExpenseList";
import Analytics from "./pages/Analytics";
import Export from "./pages/Export";
import Settings from "./pages/Settings";
import ResetPassword from "./pages/ResetPassword";
import SmsImport from "./pages/SmsImport";
import SmsRules from "./pages/SmsRules";
import { isNativeApp, NOT_FOUND_ROUTE } from "./lib/platform";
import {
  configureSmsCapture,
  hasSmsPermission,
  isSmsImportSupported,
} from "./services/smsService";
import { activeSenders, loadAutoCapture, loadRules } from "./lib/smsRules";

/** Keeps the Android status bar icons legible against the current theme. */
function NativeThemeSync() {
  const { darkMode } = useTheme();
  useStatusBarTheme(darkMode);
  return null;
}

/**
 * Pushes the sender list to the native receiver on launch.
 *
 * The receiver runs with no web layer, so it cannot read localStorage itself.
 * Without this, a fresh install would never pick up messages until the user
 * happened to open the import screen or settings first.
 */
function SmsCaptureSync() {
  useEffect(() => {
    if (!isSmsImportSupported()) return;
    void hasSmsPermission().then((granted) => {
      void configureSmsCapture(activeSenders(loadRules()), granted && loadAutoCapture());
    });
  }, []);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <SettingsProvider>
          <NativeThemeSync />
          <SmsCaptureSync />
          <BrowserRouter>
            <Routes>
              <Route
                path="/"
                element={isNativeApp ? <Navigate to="/dashboard" replace /> : <Landing />}
              />
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <Login />
                  </PublicRoute>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicRoute>
                    <Signup />
                  </PublicRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/add-data"
                element={
                  <ProtectedRoute>
                    <AddData />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/edit-transaction/:id"
                element={
                  <ProtectedRoute>
                    <EditTransaction />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/expenses"
                element={
                  <ProtectedRoute>
                    <ExpenseList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/export"
                element={
                  <ProtectedRoute>
                    <Export />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/settings"
                element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sms-import"
                element={
                  <ProtectedRoute>
                    <SmsImport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sms-rules"
                element={
                  <ProtectedRoute>
                    <SmsRules />
                  </ProtectedRoute>
                }
              />
              {/*
                Deliberately unguarded: a recovery link establishes a session
                before this page renders, so ProtectedRoute would be redundant
                and PublicRoute would bounce the user straight back to the
                dashboard. The page validates `recoveryActive` itself.
              */}
              <Route path={RESET_PASSWORD_PATH} element={<ResetPassword />} />
              <Route path="*" element={<Navigate to={NOT_FOUND_ROUTE} replace />} />
            </Routes>
            {/* Mobile-only; renders nothing on auth/marketing routes. */}
            <BottomNav />
          </BrowserRouter>
        </SettingsProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
