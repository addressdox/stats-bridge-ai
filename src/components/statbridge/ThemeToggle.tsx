import { Moon, Sun } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";

const STORAGE_KEY = "statbridge-theme";

/** Inline script: applies the stored theme before first paint, so there is no flash. */
export const themeBootstrapScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'dark';var e=document.documentElement;e.classList.remove('light','dark');e.classList.add(t==='light'?'light':'dark');}catch(_){document.documentElement.classList.add('dark');}})();`;

function applyTheme(theme: Theme) {
  const el = document.documentElement;
  el.classList.remove("light", "dark");
  el.classList.add(theme);
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? "dark";
    setTheme(stored);
    applyTheme(stored);
  }, []);

  const toggle = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        /* storage unavailable — the choice simply will not persist */
      }
      applyTheme(next);
      return next;
    });
  }, []);

  return { theme, toggle };
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-grid size-9 shrink-0 place-items-center rounded-full border border-hairline text-muted-foreground transition-colors hover:border-accent/50 hover:text-foreground ${className}`}
    >
      {isDark ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
    </button>
  );
}
