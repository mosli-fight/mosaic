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

/**
 * Keys earlier builds also wrote the preference to. They are still *read*, so a
 * choice saved by an older version is not silently lost, but every write goes to
 * `PRIMARY_KEY` alone — mirroring the value across a dozen keys on each toggle
 * only added synchronous storage work to the click handler.
 */
const LEGACY_KEYS = [
  "mosaic.theme",
  "mosaic-theme",
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

function readStoredPreference(): ThemePreference {
  const storage = globalThis.localStorage;
  if (!storage) {
    return "system";
  }

  // Primary key first, then the keys older builds wrote to. Deliberately no
  // full-storage scan: walking every key to find a preference stored under some
  // unknown name costs a synchronous loop over the whole origin for a case that
  // the primary/legacy keys already cover.
  for (const key of [PRIMARY_KEY, ...LEGACY_KEYS]) {
    const value = storage.getItem(key);
    if (isPreference(value)) {
      return value;
    }
  }

  return "system";
}

function systemPrefersDark(): boolean {
  try {
    return (
      globalThis.window?.matchMedia?.("(prefers-color-scheme: dark)")
        ?.matches ?? false
    );
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
  try {
    // One key, one write. The previous fan-out hit 14 keys synchronously on
    // every toggle, which is what made the click feel laggy.
    globalThis.localStorage?.setItem(PRIMARY_KEY, preference);
  } catch {
    // Ignore storage failures (private mode, quota, disabled storage, etc.).
  }
}

function commit(
  set: (partial: Partial<ThemeState>) => void,
  preference: ThemePreference,
): void {
  const resolved = resolvePreference(preference);
  // Order matters: the attribute swap is the change the user can *see*, so it
  // happens first and cannot be queued behind storage I/O. React state follows,
  // and the (single) persistence write runs last.
  applyToDom(resolved);
  set({ preference, resolvedTheme: resolved });
  persistPreference(preference);
}

const initialPreference = readStoredPreference();
const initialResolved = resolvePreference(initialPreference);

// Make sure the chosen preference is recorded even on first run.
applyToDom(initialResolved);
persistPreference(initialPreference);

export const useThemeStore = create<ThemeState>((set, get) => ({
  preference: initialPreference,
  resolvedTheme: initialResolved,

  setPreference: (preference: ThemePreference) => {
    commit(set, preference);
  },

  toggle: () => {
    // Flip the *effective* theme, not the raw preference: when the preference
    // is "system" the resolved value may already match what the user expects,
    // so deciding from `preference` would make a click appear to do nothing.
    // The stored preference therefore always lands on an explicit light/dark.
    const next: ThemePreference =
      get().resolvedTheme === "dark" ? "light" : "dark";
    commit(set, next);
  },
}));

// Live-update when the OS color scheme changes while preference is "system".
const mediaQuery = globalThis.window?.matchMedia?.(
  "(prefers-color-scheme: dark)",
);
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
