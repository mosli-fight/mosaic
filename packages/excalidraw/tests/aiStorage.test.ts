import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  AI_SETTINGS_STORAGE_KEY,
  clearAISettings,
  isAISettingsConfigured,
  loadAISettings,
  normalizeBaseUrl,
  saveAISettings,
} from "../components/ai/storage";

/**
 * Where the user's provider settings live.
 *
 * The settings are the user's own, so they are kept in their own browser
 * and nowhere else. These tests are about that promise: what is written,
 * what is read back, and what happens when the stored entry is not what it
 * should be.
 */

const SETTINGS = {
  baseUrl: "https://api.openai.com/v1",
  apiKey: "sk-test-key",
  model: "gpt-4o-mini",
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("normalizeBaseUrl", () => {
  it("drops the trailing slashes", () => {
    expect(normalizeBaseUrl("https://api.openai.com/v1/")).toBe(
      "https://api.openai.com/v1",
    );
    expect(normalizeBaseUrl("  https://api.openai.com/v1  ")).toBe(
      "https://api.openai.com/v1",
    );
  });
});

describe("isAISettingsConfigured", () => {
  it("needs a url, a key and a model", () => {
    expect(isAISettingsConfigured(SETTINGS)).toBe(true);
    expect(isAISettingsConfigured({ ...SETTINGS, baseUrl: "" })).toBe(false);
    expect(isAISettingsConfigured({ ...SETTINGS, apiKey: "  " })).toBe(false);
    expect(isAISettingsConfigured({ ...SETTINGS, model: "" })).toBe(false);
    expect(isAISettingsConfigured(null)).toBe(false);
  });
});

describe("saveAISettings", () => {
  it("keeps the settings in this browser", () => {
    expect(saveAISettings(SETTINGS)).toEqual(SETTINGS);
    expect(loadAISettings()).toEqual(SETTINGS);
  });

  it("keeps them under the one mosaic-ai key", () => {
    saveAISettings(SETTINGS);

    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify(SETTINGS),
    );
    expect(localStorage.length).toBe(1);
  });

  it("tidies the base url up before keeping it", () => {
    saveAISettings({ ...SETTINGS, baseUrl: "https://api.openai.com/v1/" });

    expect(loadAISettings()?.baseUrl).toBe("https://api.openai.com/v1");
  });

  it("keeps nothing when the settings are not complete", () => {
    expect(saveAISettings({ ...SETTINGS, apiKey: "" })).toBe(null);
    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe(null);
  });
});

describe("loadAISettings", () => {
  it("has nothing to say when nothing was kept", () => {
    expect(loadAISettings()).toBe(null);
  });

  it("has nothing to say about something that is not json", () => {
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, "not json");

    expect(loadAISettings()).toBe(null);
  });

  it("has nothing to say about an entry of the wrong shape", () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ baseUrl: "https://api.openai.com/v1" }),
    );

    expect(loadAISettings()).toBe(null);
  });

  it("has nothing to say about a half-written entry", () => {
    localStorage.setItem(
      AI_SETTINGS_STORAGE_KEY,
      JSON.stringify({ ...SETTINGS, model: "" }),
    );

    expect(loadAISettings()).toBe(null);
  });
});

describe("clearAISettings", () => {
  it("forgets the key as well as the rest", () => {
    saveAISettings(SETTINGS);
    clearAISettings();

    expect(localStorage.getItem(AI_SETTINGS_STORAGE_KEY)).toBe(null);
    expect(loadAISettings()).toBe(null);
  });
});
