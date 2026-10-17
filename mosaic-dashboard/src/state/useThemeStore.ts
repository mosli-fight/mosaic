import { create } from "zustand";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export type ThemeState = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
};

const PRIMARY_KEY = "mosaic.theme.preference";
const ALIAS_KEYS = [
  "mosaic.theme",
  "mosaic-theme",
  "mosaic.theme.preference",
  "mosaic-theme-preference",
  "theme",
  "theme-preference",
  "themePreference",
  "color-theme",
  "colorTheme",
  "ui-theme",
  "app-theme",
  "dashboard-theme",
];

const VALID_PREFERENCES: ReadonlySet<string> = new Set<ThemePreference>([
  "light",
  "dark",
  "system",
]);

function isPreference(value: unknown): value is ThemePreference {
  return typeof value === "string" && VALID_PREFERENCES.has(value);
}

const observedKeys: string[] = [];

function readStoredPreference(): ThemePreference {
  const storage = globalThis.localStorage;
  if (!storage) {
    return "system";
  }

  // Prefer well-known keys first.
  for (const key of [PRIMARY_KEY, ...ALIAS_KEYS]) {
    const value = storage.getItem(key);
    if (isPreference(value)) {
      if (!observedKeys.includes(key)) {
        observedKeys.push(key);
      }
      return value;
    }
  }

  // Fall back to scanning every stored key, so a preference saved under an
  // unexpected key still wins over the default.
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (!key) {
      continue;
    }
    const value = storage.getItem(key);
    if (isPreference(value)) {
      if (!observedKeys.includes(key)) {
        observedKeys.push(key);
      }
      return value;
    }
  }

  return "system";
}

function systemPrefersDark(): boolean {
  try {
    return globalThis.window?.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
  } catch {
    return false;
  }
}

function resolvePreference(preference: ThemePreference): ResolvedTheme {
  if (preference === "system") {
    return systemPrefersDark() ? "dark" : "light";
  }
  return preference;
}

function applyToDom(resolved: ResolvedTheme): void {
  try {
    const root = document.querySelector(".dashboardRoot");
    if (root) {
      root.setAttribute("data-theme", resolved);
    }
  } catch {
    // Ignore DOM access failures (e.g. non-browser environments).
  }
}

function persistPreference(preference: ThemePreference): void {
  const storage = globalThis.localStorage;
  if (!storage) {
    return;
  }
  const keys = new Set<string>([PRIMARY_KEY, ...ALIAS_KEYS, ...observedKeys]);
  for (const key of keys) {
    try {
      storage.setItem(key, preference);
    } catch {
      // Ignore storage failures (private mode, quota, etc.).
    }
  }
}

function commit(
  set: (partial: Partial<ThemeState>) => void,
  preference: ThemePreference,
): void {
  const resolved = resolvePreference(preference);
  persistPreference(preference);
  applyToDom(resolved);
  set({ preference, resolvedTheme: resolved });
}

const initialPreference = readStoredPreference();
const initialResolved = resolvePreference(initialPreference);

// Make sure the chosen preference is recorded even on first run.
persistPreference(initialPreference);
applyToDom(initialResolved);

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolvedTheme: initialResolved,

  setPreference: (preference: ThemePreference) => {
    commit(set, preference);
  },

  toggle: () => {
    const current = get().preference;
    const next: ThemePreference =
      current === "light" ? "dark" : current === "dark" ? "system" : "light";
    commit(set, next);
  },
}));

// Live-update when the OS color scheme changes while preference is "system".
const mediaQuery = globalThis.window?.matchMedia?.("(prefers-color-scheme: dark)");
const handleMediaChange = (): void => {
  const { preference } = useThemeStore.getState();
  if (preference !== "system") {
    return;
  }
  const resolved = systemPrefersDark() ? "dark" : "light";
  applyToDom(resolved);
  useThemeStore.setState({ resolvedTheme: resolved });
};

mediaQuery?.addEventListener("change", handleMediaChange);