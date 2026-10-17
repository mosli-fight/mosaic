import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ThemePreference } from "@/state/useThemeStore";

type ThemeModule = typeof import("@/state/useThemeStore");

const PRIMARY_KEY = "mosaic.theme.preference";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

/**
 * `prefers-color-scheme` is controlled per test so the store's system
 * resolution can be exercised in both directions. `mediaListeners` collects the
 * "change" handlers the store registers, which lets a test simulate the OS
 * flipping its colour scheme at runtime.
 */
let systemDark = false;
let mediaListeners: Array<() => void> = [];

function stubMatchMedia(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      media: query,
      get matches(): boolean {
        return query === MEDIA_QUERY && systemDark;
      },
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: (_type: string, listener: () => void) => {
        if (query === MEDIA_QUERY) {
          mediaListeners.push(listener);
        }
      },
      removeEventListener: (_type: string, listener: () => void) => {
        mediaListeners = mediaListeners.filter((l) => l !== listener);
      },
      dispatchEvent: () => false,
    }),
  });
}

/**
 * The store reads the stored preference and registers the OS listener at
 * module-evaluation time, so every case re-imports it to get a fresh module
 * (and therefore a fresh first-load state).
 */
async function loadStore(): Promise<ThemeModule> {
  vi.resetModules();
  return import("@/state/useThemeStore");
}

beforeEach(() => {
  localStorage.clear();
  systemDark = false;
  mediaListeners = [];
  stubMatchMedia();
});

describe("useThemeStore first load", () => {
  it("defaults to the system preference when nothing is stored", async () => {
    const { useThemeStore } = await loadStore();
    const state = useThemeStore.getState();

    expect(state.preference).toBe("system");
    expect(state.resolvedTheme).toBe("light");
    expect(localStorage.getItem(PRIMARY_KEY)).toBe("system");
  });

  it("resolves the system default against the OS colour scheme", async () => {
    systemDark = true;
    const { useThemeStore } = await loadStore();
    const state = useThemeStore.getState();

    expect(state.preference).toBe("system");
    expect(state.resolvedTheme).toBe("dark");
  });

  it("restores an explicitly stored preference", async () => {
    localStorage.setItem(PRIMARY_KEY, "dark");

    const { useThemeStore } = await loadStore();
    const state = useThemeStore.getState();

    expect(state.preference).toBe("dark");
    expect(state.resolvedTheme).toBe("dark");
  });

  it("restores a preference left behind by an older build's key", async () => {
    localStorage.setItem("mosaic-theme", "dark");

    const { useThemeStore } = await loadStore();
    const state = useThemeStore.getState();

    expect(state.preference).toBe("dark");
    expect(state.resolvedTheme).toBe("dark");
  });
});

describe("useThemeStore.toggle", () => {
  it("switches dark to light in a single click", async () => {
    const { useThemeStore } = await loadStore();
    useThemeStore.getState().setPreference("dark");

    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();

    expect(state.resolvedTheme).toBe("light");
    expect(state.preference).toBe("light");
    expect(localStorage.getItem(PRIMARY_KEY)).toBe("light");
  });

  it("switches light to dark in a single click", async () => {
    const { useThemeStore } = await loadStore();
    useThemeStore.getState().setPreference("light");

    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();

    expect(state.resolvedTheme).toBe("dark");
    expect(state.preference).toBe("dark");
    expect(localStorage.getItem(PRIMARY_KEY)).toBe("dark");
  });

  it("goes system/dark -> light in one click, never through system", async () => {
    systemDark = true;
    const { useThemeStore } = await loadStore();
    expect(useThemeStore.getState().resolvedTheme).toBe("dark");

    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();

    // A visible change on the very first click...
    expect(state.resolvedTheme).toBe("light");
    // ...and an explicit preference, not "system".
    expect(state.preference).toBe("light");
    expect(localStorage.getItem(PRIMARY_KEY)).toBe("light");
  });

  it("goes system/light -> dark in one click, never through system", async () => {
    systemDark = false;
    const { useThemeStore } = await loadStore();
    expect(useThemeStore.getState().resolvedTheme).toBe("light");

    useThemeStore.getState().toggle();
    const state = useThemeStore.getState();

    expect(state.resolvedTheme).toBe("dark");
    expect(state.preference).toBe("dark");
    expect(localStorage.getItem(PRIMARY_KEY)).toBe("dark");
  });

  it("never leaves the preference on system after a manual toggle", async () => {
    systemDark = true;
    const { useThemeStore } = await loadStore();

    useThemeStore.getState().toggle();
    useThemeStore.getState().toggle();

    const state = useThemeStore.getState();
    const stored = localStorage.getItem(PRIMARY_KEY) as ThemePreference | null;

    expect(state.preference).not.toBe("system");
    expect(stored).not.toBe("system");
    expect(stored).toBe(state.preference);
  });

  it("is a binary toggle: two clicks return to the starting theme", async () => {
    const { useThemeStore } = await loadStore();
    useThemeStore.getState().setPreference("light");
    const start = useThemeStore.getState().resolvedTheme;

    useThemeStore.getState().toggle();
    const once = useThemeStore.getState();
    expect(once.resolvedTheme).not.toBe(start);

    useThemeStore.getState().toggle();
    const twice = useThemeStore.getState();
    expect(twice.resolvedTheme).toBe(start);
    expect(twice.preference).toBe("light");
  });

  it("keeps working after the OS changes colour scheme under system", async () => {
    const { useThemeStore } = await loadStore();
    expect(useThemeStore.getState().resolvedTheme).toBe("light");

    systemDark = true;
    mediaListeners.forEach((listener) => listener());

    const updated = useThemeStore.getState();
    expect(updated.preference).toBe("system");
    expect(updated.resolvedTheme).toBe("dark");

    // The live update must feed the next toggle decision too.
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().resolvedTheme).toBe("light");
  });
});

describe("useThemeStore persistence", () => {
  it("writes the primary key only, never a fan-out of aliases", async () => {
    const { useThemeStore } = await loadStore();
    // First run records the default under the one canonical key.
    expect(localStorage.length).toBe(1);

    useThemeStore.getState().toggle();

    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(PRIMARY_KEY)).toBe("dark");
  });

  it("swaps the visible theme before it touches storage", async () => {
    const root = document.createElement("div");
    root.className = "dashboardRoot";
    document.body.appendChild(root);

    try {
      const { useThemeStore } = await loadStore();

      const order: string[] = [];
      const originalSetAttribute = root.setAttribute.bind(root);
      root.setAttribute = ((name: string, value: string) => {
        if (name === "data-theme") {
          order.push("dom");
        }
        originalSetAttribute(name, value);
      }) as typeof root.setAttribute;

      vi.spyOn(Storage.prototype, "setItem").mockImplementation(
        (key: string) => {
          if (key === PRIMARY_KEY) {
            order.push("storage");
          }
        },
      );

      useThemeStore.getState().toggle();

      // The attribute swap is what the user sees, so it must never queue behind
      // the synchronous localStorage write.
      expect(order).toEqual(["dom", "storage"]);
      expect(root.getAttribute("data-theme")).toBe("dark");
    } finally {
      vi.restoreAllMocks();
      root.remove();
    }
  });
});
