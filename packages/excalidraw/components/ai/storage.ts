/**
 * Where the user's provider settings live.
 *
 * The settings are the user's own — their endpoint, their key, their model —
 * so they are kept in their own browser, in `localStorage`, under a single
 * `mosaic-ai` key. They are never written into the scene, never exported
 * with it, and never sent anywhere except the base url the user set.
 */

import type { AISettings } from "./types";

/** the one key everything the assistant remembers lives under */
export const AI_SETTINGS_STORAGE_KEY = "mosaic-ai-settings";

/**
 * The bits of `Storage` the settings need.
 *
 * Narrowed on purpose: it makes the helpers testable without a real
 * `Storage`, and it documents that nothing else is ever touched.
 */
type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * The browser's `localStorage`, if there is one.
 *
 * It can be missing (server-side rendering, the node build) and it can
 * throw (private browsing, blocked cookies) — neither is worth crashing the
 * editor over, so both are shrugged off.
 */
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
 * The base url in the shape the api client wants it: no surrounding space
 * and no trailing slash, so that `baseUrl + "/chat/completions"` is always
 * a well-formed url.
 */
export const normalizeBaseUrl = (baseUrl: string): string =>
  (baseUrl ?? "").trim().replace(/\/+$/, "");

/**
 * Whether the settings are complete enough to talk to a provider with.
 *
 * All three parts are needed: a base url to call, a key to be allowed, and a
 * model to talk to.
 */
export const isAISettingsConfigured = (
  settings: AISettings | null | undefined,
): settings is AISettings =>
  !!settings &&
  !!normalizeBaseUrl(settings.baseUrl) &&
  !!settings.apiKey?.trim() &&
  !!settings.model?.trim();

/**
 * The settings as they are stored.
 *
 * Anything that is not a string is not a setting, and a setting that is not
 * complete is no setting at all — a half-written entry from an older
 * version of the panel is treated as no entry.
 */
const parseSettings = (raw: string | null): AISettings | null => {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const { baseUrl, apiKey, model } = parsed as Partial<AISettings>;

  if (
    typeof baseUrl !== "string" ||
    typeof apiKey !== "string" ||
    typeof model !== "string"
  ) {
    return null;
  }

  const settings: AISettings = {
    baseUrl: normalizeBaseUrl(baseUrl),
    apiKey,
    model: model.trim(),
  };

  return isAISettingsConfigured(settings) ? settings : null;
};

/**
 * The user's settings, or `null` if they have not configured a provider.
 */
export const loadAISettings = (): AISettings | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    return parseSettings(storage.getItem(AI_SETTINGS_STORAGE_KEY));
  } catch {
    return null;
  }
};

/**
 * Remembers the user's settings.
 *
 * @returns the settings as they were stored, or `null` if they could not be
 * stored (in which case the panel says so rather than pretending).
 */
export const saveAISettings = (settings: AISettings): AISettings | null => {
  const normalized: AISettings = {
    baseUrl: normalizeBaseUrl(settings.baseUrl),
    apiKey: settings.apiKey.trim(),
    model: settings.model.trim(),
  };

  if (!isAISettingsConfigured(normalized)) {
    return null;
  }

  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    storage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
};

/**
 * Forgets the user's settings — the key included.
 */
export const clearAISettings = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(AI_SETTINGS_STORAGE_KEY);
  } catch {
    // nothing to do — the settings are gone either way
  }
};
