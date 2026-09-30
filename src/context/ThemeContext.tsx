import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ColorPalette = "amethyst" | "emerald" | "ruby" | "oceanic" | "orange";

interface PaletteColors {
  primary: string;
  primaryLight: string;
  primaryDark: string;
}

const PALETTES: Record<ColorPalette, PaletteColors> = {
  amethyst: { primary: "#8b5cf6", primaryLight: "#a78bfa", primaryDark: "#6d28d9" },
  emerald: { primary: "#10b981", primaryLight: "#34d399", primaryDark: "#059669" },
  ruby: { primary: "#f43f5e", primaryLight: "#fb7185", primaryDark: "#e11d48" },
  oceanic: { primary: "#0ea5e9", primaryLight: "#38bdf8", primaryDark: "#0284c7" },
  orange: { primary: "#f97316", primaryLight: "#fb923c", primaryDark: "#ea580c" },
};

interface ThemeContextType {
  palette: ColorPalette;
  colors: PaletteColors;
  darkMode: boolean;
  setPalette: (p: ColorPalette) => void;
  toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}

function readPalette(): ColorPalette {
  const saved = localStorage.getItem("expense_palette");
  return saved && saved in PALETTES ? (saved as ColorPalette) : "amethyst";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [palette, setPaletteState] = useState<ColorPalette>(readPalette);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("expense_dark_mode") === "true");

  useEffect(() => {
    localStorage.setItem("expense_palette", palette);
  }, [palette]);

  useEffect(() => {
    localStorage.setItem("expense_dark_mode", darkMode.toString());
    document.documentElement.classList.toggle("dark", darkMode);
  }, [darkMode]);

  const setPalette = (p: ColorPalette) => setPaletteState(p);
  const toggleDarkMode = () => setDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider
      value={{ palette, colors: PALETTES[palette], darkMode, setPalette, toggleDarkMode }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export { PALETTES };
