"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Lightweight theme system — no next-themes dependency so the app
// stays deployable as a plain standalone build. The no-flash inline
// script in the root layout sets the initial class before paint;
// this provider keeps React state in sync and persists the choice.

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

const STORAGE_KEY = "wpistic-theme";

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.add("theme-transition");
  root.classList.toggle("dark", resolved === "dark");
  root.style.colorScheme = resolved;
  window.setTimeout(() => root.classList.remove("theme-transition"), 250);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Light is the product default — visitors without a stored choice get
  // the light theme regardless of OS preference. "system" stays available
  // as an explicit opt-in via the theme toggle.
  const [theme, setThemeState] = useState<Theme>("light");
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>("light");

  // Hydrate from storage on mount. localStorage is unavailable during
  // SSR, so this necessarily runs as a post-mount state sync.
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    const initial: Theme =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "light";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
  }, []);

  // Re-resolve and apply whenever the chosen theme changes. The OS
  // preference is only readable client-side, so resolvedTheme is
  // synced here rather than derived during render.
  useEffect(() => {
    const resolved = theme === "system" ? systemTheme() : theme;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, [theme]);

  // Follow OS changes only while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const resolved = systemTheme();
      setResolvedTheme(resolved);
      applyTheme(resolved);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => {
      const current = prev === "system" ? systemTheme() : prev;
      const next: Theme = current === "dark" ? "light" : "dark";
      window.localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, toggleTheme }),
    [theme, resolvedTheme, setTheme, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Inline, blocking script — runs before paint to avoid a theme flash.
 * Mirrors the provider's default: no stored choice → light; the OS
 * preference only applies when "system" was explicitly chosen. */
export const themeInitScript = `
(function(){try{
var t=localStorage.getItem('${STORAGE_KEY}');
var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
if(d)r.classList.add('dark');
r.style.colorScheme=d?'dark':'light';
}catch(e){}})();
`;
