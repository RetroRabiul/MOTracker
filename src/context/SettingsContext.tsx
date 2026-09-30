import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface SettingsContextType {
  defaultCurrency: string;
  setDefaultCurrency: (c: string) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used within SettingsProvider");
  return context;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [defaultCurrency, setDefaultCurrencyState] = useState(
    () => localStorage.getItem("expense_default_currency") || "USD",
  );

  useEffect(() => {
    localStorage.setItem("expense_default_currency", defaultCurrency);
  }, [defaultCurrency]);

  const setDefaultCurrency = (c: string) => setDefaultCurrencyState(c);

  return (
    <SettingsContext.Provider value={{ defaultCurrency, setDefaultCurrency }}>
      {children}
    </SettingsContext.Provider>
  );
}
