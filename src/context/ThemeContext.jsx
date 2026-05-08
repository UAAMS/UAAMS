import { createContext, useContext, useEffect, useMemo, useState } from "react";

const THEME_KEY = "uaams_theme";
const VALID_THEMES = new Set(["light", "dark", "system"]);

const ThemeContext = createContext(null);

const resolveTheme = (storedTheme) => {
  if (!VALID_THEMES.has(storedTheme)) return "light";
  if (storedTheme === "system") {
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    return prefersDark ? "dark" : "light";
  }
  return storedTheme;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    try {
      const storedTheme = localStorage.getItem(THEME_KEY);
      return VALID_THEMES.has(storedTheme) ? storedTheme : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    const activeTheme = resolveTheme(theme);
    document.documentElement.setAttribute("data-theme", activeTheme);
    document.documentElement.classList.toggle("dark", activeTheme === "dark");
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore storage errors
    }
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme: (nextTheme) => {
        if (!VALID_THEMES.has(nextTheme)) return;
        setTheme(nextTheme);
      },
      toggleTheme: () =>
        setTheme((previous) => {
          const active = resolveTheme(previous);
          return active === "dark" ? "light" : "dark";
        }),
      activeTheme: resolveTheme(theme),
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used inside ThemeProvider");
  }
  return context;
};
