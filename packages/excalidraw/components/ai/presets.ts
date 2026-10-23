/**
 * The user's saved AI presets.
 *
 * A preset is a block of rules the user wants every answer to follow —
 * "keep labels under four words", "use British spelling" — saved under a
 * name so it can be switched back on later. Presets are the user's own
 * text: they are kept in this browser, under their own key, and they are
 * only ever sent to the provider the user configured, as part of the system
 * prompt.
 *
 * They are deliberately kept apart from `mosaic-ai-settings`: the settings
 * are the provider (url, key, model), the presets are how the user wants the
 * model to write. Keeping them apart means an older panel that only knows
 * about settings reads and writes them unchanged.
 */

import { nanoid } from "nanoid";

import type { AIPreset, AIPresetsState } from "./types";

/** the key the presets live under, next to — never inside — the settings */
export const AI_PRESETS_STORAGE_KEY = "mosaic-ai-presets";

/**
 * The bits of `Storage` the presets need.
 *
 * Narrowed on purpose, exactly like the settings store: it makes the helpers
 * testable without a real `Storage`, and it documents that nothing else is
 * touched.
 */
type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/** the browser's `localStorage`, if there is one (see `storage.ts`) */
const getStorage = (): StorageLike | null => {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
};

/**
 * The presets everyone starts with.
 *
 * They are examples, not fixtures: the user can rename them, edit their
 * rules, or delete them, and a deleted one stays deleted because the whole
 * list is written back on every change.
 */
export const DEFAULT_AI_PRESETS: readonly AIPreset[] = [
  {
    id: "builtin-concise-labels",
    name: "Concise labels",
    rules:
      "Keep every label under four words. Prefer verbs for actions and nouns for things. Do not repeat the diagram type in a label.",
  },
  {
    id: "builtin-developer-docs",
    name: "Developer docs style",
    rules:
      "Write for software engineers. Use the exact names of services, protocols and data stores. Prefer technical terms over marketing language, and keep sentences short.",
  },
];

/** the empty preset state: the built-in examples, none of them applied */
export const emptyAIPresetsState = (): AIPresetsState => ({
  presets: DEFAULT_AI_PRESETS.map((preset) => ({ ...preset })),
  activeId: null,
});

/** a preset is only a preset if it has an id, a name and rules */
const isPreset = (value: unknown): value is AIPreset => {
  if (!value || typeof value !== "object") {
    return false;
  }
  const { id, name, rules } = value as Partial<AIPreset>;
  return (
    typeof id === "string" &&
    !!id.trim() &&
    typeof name === "string" &&
    !!name.trim() &&
    typeof rules === "string"
  );
};

/**
 * The stored state, or the defaults when there is nothing usable.
 *
 * A half-written or hand-edited entry falls back to the defaults rather than
 * crashing the panel: the presets are a convenience, not the user's data.
 */
const parseState = (raw: string | null): AIPresetsState => {
  if (!raw) {
    return emptyAIPresetsState();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyAIPresetsState();
  }

  if (!parsed || typeof parsed !== "object") {
    return emptyAIPresetsState();
  }

  const { presets, activeId } = parsed as Partial<AIPresetsState>;

  if (!Array.isArray(presets)) {
    return emptyAIPresetsState();
  }

  const valid = presets.filter(isPreset).map((preset) => ({
    id: preset.id,
    name: preset.name.trim(),
    rules: preset.rules,
  }));

  const active =
    typeof activeId === "string" &&
    valid.some((preset) => preset.id === activeId)
      ? activeId
      : null;

  return { presets: valid, activeId: active };
};

/** the user's presets, or the built-in examples when nothing was saved */
export const loadAIPresets = (): AIPresetsState => {
  const storage = getStorage();
  if (!storage) {
    return emptyAIPresetsState();
  }

  try {
    return parseState(storage.getItem(AI_PRESETS_STORAGE_KEY));
  } catch {
    return emptyAIPresetsState();
  }
};

/**
 * Writes the whole preset state back.
 *
 * @returns the state as it was stored, or `null` when it could not be stored
 * (the panel says so rather than pretending)
 */
export const saveAIPresets = (state: AIPresetsState): AIPresetsState | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    storage.setItem(AI_PRESETS_STORAGE_KEY, JSON.stringify(state));
    return state;
  } catch {
    return null;
  }
};

/** the preset that is applied right now, if any */
export const getActivePreset = (state: AIPresetsState): AIPreset | null =>
  state.presets.find((preset) => preset.id === state.activeId) ?? null;

/** the rules of the applied preset, or an empty string when none is */
export const getActivePresetRules = (state: AIPresetsState): string =>
  getActivePreset(state)?.rules ?? "";

/**
 * Adds a preset.
 *
 * A preset without a name or without rules is not worth saving, so nothing
 * is added and `null` is returned — the panel tells the user why.
 */
export const createPreset = (
  state: AIPresetsState,
  name: string,
  rules: string,
): { state: AIPresetsState; preset: AIPreset } | null => {
  const trimmedName = name.trim();
  const trimmedRules = rules.trim();

  if (!trimmedName || !trimmedRules) {
    return null;
  }

  const preset: AIPreset = {
    id: nanoid(),
    name: trimmedName,
    rules: trimmedRules,
  };

  return {
    state: { ...state, presets: [...state.presets, preset] },
    preset,
  };
};

/** renames a preset; a blank name changes nothing */
export const renamePreset = (
  state: AIPresetsState,
  id: string,
  name: string,
): AIPresetsState => {
  const trimmed = name.trim();

  if (!trimmed) {
    return state;
  }

  return {
    ...state,
    presets: state.presets.map((preset) =>
      preset.id === id ? { ...preset, name: trimmed } : preset,
    ),
  };
};

/** replaces a preset's rules; the rules may be emptied, the name may not */
export const updatePresetRules = (
  state: AIPresetsState,
  id: string,
  rules: string,
): AIPresetsState => ({
  ...state,
  presets: state.presets.map((preset) =>
    preset.id === id ? { ...preset, rules } : preset,
  ),
});

/**
 * Deletes a preset.
 *
 * Deleting the applied preset leaves nothing applied, rather than silently
 * applying whatever happens to be first.
 */
export const deletePreset = (
  state: AIPresetsState,
  id: string,
): AIPresetsState => ({
  presets: state.presets.filter((preset) => preset.id !== id),
  activeId: state.activeId === id ? null : state.activeId,
});

/** applies a preset, or clears the applied one when `id` is `null` */
export const setActivePreset = (
  state: AIPresetsState,
  id: string | null,
): AIPresetsState => ({
  ...state,
  activeId: id && state.presets.some((preset) => preset.id === id) ? id : null,
});
