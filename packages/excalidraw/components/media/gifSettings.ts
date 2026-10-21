/**
 * Where the user's GIF provider key lives.
 *
 * Mosaic ships no GIF provider key of its own: the user brings their own,
 * the way they bring their own key to the assistant. The key is kept in
 * this browser, in `localStorage`, under a single `mosaic-gif` key. It is
 * never written into the scene, never exported with it, and never sent
 * anywhere except the provider the user chose to use.
 */

/** the one key everything about the GIF provider lives under */
export const GIF_SETTINGS_STORAGE_KEY = "mosaic-gif-settings";

/** the settings of the GIF provider */
export type GifSettings = {
  /** the provider's api key */
  apiKey: string;
};

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
 * throw (private browsing, blocked cookies) — neither is worth crashing
 * the editor over, so both are shrugged off.
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
 * Whether the settings are complete enough to search with.
 */
export const isGifSettingsConfigured = (
  settings: GifSettings | null | undefined,
): settings is GifSettings => !!settings && !!settings.apiKey?.trim();

/**
 * The settings as they are stored.
 *
 * Anything that is not a string is not a setting, and a setting without a
 * key is no setting at all — a half-written entry from an older version of
 * the panel is treated as no entry.
 */
const parseSettings = (raw: string | null): GifSettings | null => {
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

  const { apiKey } = parsed as Partial<GifSettings>;

  if (typeof apiKey !== "string") {
    return null;
  }

  const settings: GifSettings = { apiKey: apiKey.trim() };

  return isGifSettingsConfigured(settings) ? settings : null;
};

/**
 * The user's settings, or `null` if they have not configured a provider.
 */
export const loadGifSettings = (): GifSettings | null => {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    return parseSettings(storage.getItem(GIF_SETTINGS_STORAGE_KEY));
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
export const saveGifSettings = (settings: GifSettings): GifSettings | null => {
  const normalized: GifSettings = { apiKey: settings.apiKey.trim() };

  if (!isGifSettingsConfigured(normalized)) {
    return null;
  }

  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    storage.setItem(GIF_SETTINGS_STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return null;
  }
};

/**
 * Forgets the user's settings — the key included.
 */
export const clearGifSettings = (): void => {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(GIF_SETTINGS_STORAGE_KEY);
  } catch {
    // nothing to do — the settings are gone either way
  }
};
