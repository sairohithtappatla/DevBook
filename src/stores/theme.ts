import { useEffect, useState, useSyncExternalStore } from "react";

type Theme = "light" | "dark";
const KEY = "devbook-theme";

function applyTheme(t: Theme, persist: boolean) {
  if (typeof document === "undefined") return;
  const c = document.documentElement.classList;
  t === "dark" ? c.add("dark") : c.remove("dark");
  try {
    if (persist) localStorage.setItem(KEY, t);
  } catch {}
  emit();
}

function getPreference(): Theme {
  if (typeof window === "undefined") return "dark";
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {}
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getInitial(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

const listeners = new Set<() => void>();
function emit() {
  listeners.forEach((l) => l());
}

export function setTheme(t: Theme) {
  applyTheme(t, true);
}

export function syncThemeFromPreference() {
  applyTheme(getPreference(), false);
}

export function useTheme(): [Theme, (t: Theme) => void, () => void] {
  const theme = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => getInitial(),
    () => "dark" as Theme,
  );
  const toggle = () => setTheme(theme === "dark" ? "light" : "dark");
  return [theme, setTheme, toggle];
}

export function useMounted() {
  const [m, setM] = useState(false);
  useEffect(() => setM(true), []);
  return m;
}
