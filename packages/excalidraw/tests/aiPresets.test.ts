import { beforeEach, describe, expect, it } from "vitest";

import {
  AI_PRESETS_STORAGE_KEY,
  createPreset,
  DEFAULT_AI_PRESETS,
  deletePreset,
  emptyAIPresetsState,
  getActivePreset,
  getActivePresetRules,
  loadAIPresets,
  renamePreset,
  saveAIPresets,
  setActivePreset,
  updatePresetRules,
} from "../components/ai/presets";

import type { AIPresetsState } from "../components/ai/types";

/**
 * The user's saved AI presets.
 *
 * A preset is a block of rules the user wrote for themselves, so the store
 * has two jobs: keep them in this browser, and keep them out of the
 * settings. These tests are about both — what is written, what is read
 * back, and what happens when the stored entry is not what it should be.
 */

beforeEach(() => {
  localStorage.clear();
});

describe("the built-in presets", () => {
  it("starts with two examples, none applied", () => {
    const state = loadAIPresets();

    expect(state.presets.map((preset) => preset.name)).toEqual([
      "Concise labels",
      "Developer docs style",
    ]);
    expect(state.activeId).toBe(null);
  });

  it("gives every built-in preset rules and a unique id", () => {
    const ids = DEFAULT_AI_PRESETS.map((preset) => preset.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const preset of DEFAULT_AI_PRESETS) {
      expect(preset.rules.trim()).not.toBe("");
    }
  });

  it("does not write anything until the user changes something", () => {
    loadAIPresets();

    expect(localStorage.getItem(AI_PRESETS_STORAGE_KEY)).toBe(null);
  });
});

describe("saveAIPresets", () => {
  it("keeps the presets under their own key, not the settings key", () => {
    const state = setActivePreset(loadAIPresets(), DEFAULT_AI_PRESETS[0].id);

    expect(saveAIPresets(state)).toEqual(state);
    expect(localStorage.getItem(AI_PRESETS_STORAGE_KEY)).not.toBe(null);
    expect(localStorage.getItem("mosaic-ai-settings")).toBe(null);
    expect(loadAIPresets()).toEqual(state);
  });

  it("keeps a deleted built-in preset deleted", () => {
    const state = deletePreset(loadAIPresets(), DEFAULT_AI_PRESETS[0].id);
    saveAIPresets(state);

    expect(loadAIPresets().presets.map((preset) => preset.name)).toEqual([
      "Developer docs style",
    ]);
  });
});

describe("loadAIPresets", () => {
  it("falls back to the examples when the entry is not json", () => {
    localStorage.setItem(AI_PRESETS_STORAGE_KEY, "not json");

    expect(loadAIPresets()).toEqual(emptyAIPresetsState());
  });

  it("falls back when the entry has the wrong shape", () => {
    localStorage.setItem(
      AI_PRESETS_STORAGE_KEY,
      JSON.stringify({ presets: "nope" }),
    );

    expect(loadAIPresets()).toEqual(emptyAIPresetsState());
  });

  it("drops entries that are not presets", () => {
    localStorage.setItem(
      AI_PRESETS_STORAGE_KEY,
      JSON.stringify({
        presets: [
          { id: "a", name: "Keep me", rules: "Be brief." },
          { id: "", name: "No id", rules: "x" },
          { id: "b", name: "  ", rules: "x" },
          { id: "c", name: "No rules" },
          "not an object",
        ],
        activeId: null,
      }),
    );

    expect(loadAIPresets().presets).toEqual([
      { id: "a", name: "Keep me", rules: "Be brief." },
    ]);
  });

  it("forgets an applied preset that is no longer in the list", () => {
    localStorage.setItem(
      AI_PRESETS_STORAGE_KEY,
      JSON.stringify({
        presets: [{ id: "a", name: "Keep me", rules: "Be brief." }],
        activeId: "gone",
      }),
    );

    expect(loadAIPresets().activeId).toBe(null);
  });
});

describe("createPreset", () => {
  it("adds a preset with a fresh id", () => {
    const before = emptyAIPresetsState();
    const created = createPreset(
      before,
      "  House style  ",
      "  Use British spelling.  ",
    );

    expect(created).not.toBe(null);
    expect(created!.preset.name).toBe("House style");
    expect(created!.preset.rules).toBe("Use British spelling.");
    expect(created!.preset.id).toBeTruthy();
    expect(created!.state.presets).toHaveLength(before.presets.length + 1);
    expect(created!.state.presets.at(-1)).toEqual(created!.preset);
  });

  it("does not change which preset is applied", () => {
    const before = setActivePreset(
      emptyAIPresetsState(),
      DEFAULT_AI_PRESETS[0].id,
    );
    const created = createPreset(before, "New", "Rules");

    expect(created!.state.activeId).toBe(DEFAULT_AI_PRESETS[0].id);
  });

  it("refuses a preset without a name or without rules", () => {
    const state = emptyAIPresetsState();

    expect(createPreset(state, "  ", "Rules")).toBe(null);
    expect(createPreset(state, "Name", "   ")).toBe(null);
  });
});

describe("renamePreset", () => {
  it("renames the preset it is given, and nothing else", () => {
    const state = emptyAIPresetsState();
    const [first, second] = state.presets;

    const renamed = renamePreset(state, first.id, "  Terse  ");

    expect(renamed.presets[0].name).toBe("Terse");
    expect(renamed.presets[1]).toEqual(second);
  });

  it("leaves the name alone when the new one is blank", () => {
    const state = emptyAIPresetsState();

    expect(renamePreset(state, state.presets[0].id, "   ")).toEqual(state);
  });
});

describe("updatePresetRules", () => {
  it("replaces the rules of one preset", () => {
    const state = emptyAIPresetsState();

    const updated = updatePresetRules(state, state.presets[0].id, "Short.");

    expect(updated.presets[0].rules).toBe("Short.");
    expect(updated.presets[1].rules).toBe(state.presets[1].rules);
  });
});

describe("deletePreset", () => {
  it("removes a preset", () => {
    const state = emptyAIPresetsState();

    const deleted = deletePreset(state, state.presets[0].id);

    expect(deleted.presets).toHaveLength(state.presets.length - 1);
    expect(
      deleted.presets.some((preset) => preset.id === state.presets[0].id),
    ).toBe(false);
  });

  it("leaves nothing applied when the applied preset is deleted", () => {
    const state = setActivePreset(
      emptyAIPresetsState(),
      DEFAULT_AI_PRESETS[0].id,
    );

    const deleted = deletePreset(state, DEFAULT_AI_PRESETS[0].id);

    expect(deleted.activeId).toBe(null);
    expect(getActivePresetRules(deleted)).toBe("");
  });

  it("keeps another preset applied when a different one is deleted", () => {
    const state = setActivePreset(
      emptyAIPresetsState(),
      DEFAULT_AI_PRESETS[0].id,
    );

    const deleted = deletePreset(state, DEFAULT_AI_PRESETS[1].id);

    expect(deleted.activeId).toBe(DEFAULT_AI_PRESETS[0].id);
  });
});

describe("setActivePreset", () => {
  it("applies a preset that exists", () => {
    const state = setActivePreset(
      emptyAIPresetsState(),
      DEFAULT_AI_PRESETS[1].id,
    );

    expect(state.activeId).toBe(DEFAULT_AI_PRESETS[1].id);
    expect(getActivePreset(state)?.name).toBe("Developer docs style");
    expect(getActivePresetRules(state)).toBe(DEFAULT_AI_PRESETS[1].rules);
  });

  it("applies nothing for an id that is not there", () => {
    const state = setActivePreset(emptyAIPresetsState(), "gone");

    expect(state.activeId).toBe(null);
  });

  it("clears the applied preset with null", () => {
    const applied = setActivePreset(
      emptyAIPresetsState(),
      DEFAULT_AI_PRESETS[0].id,
    );

    expect(setActivePreset(applied, null).activeId).toBe(null);
  });
});

describe("getActivePresetRules", () => {
  it("is empty when nothing is applied", () => {
    expect(getActivePresetRules(emptyAIPresetsState())).toBe("");
  });

  it("follows the rules when they are edited", () => {
    const applied = setActivePreset(
      emptyAIPresetsState(),
      DEFAULT_AI_PRESETS[0].id,
    );
    const edited = updatePresetRules(
      applied,
      DEFAULT_AI_PRESETS[0].id,
      "New rules.",
    );

    expect(getActivePresetRules(edited)).toBe("New rules.");
  });
});

describe("the preset state is independent of the settings", () => {
  it("round-trips through storage without touching a settings entry", () => {
    localStorage.setItem(
      "mosaic-ai-settings",
      JSON.stringify({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      }),
    );

    const state: AIPresetsState = createPreset(
      emptyAIPresetsState(),
      "Mine",
      "Rules.",
    )!.state;

    saveAIPresets(state);

    expect(localStorage.getItem("mosaic-ai-settings")).toBe(
      JSON.stringify({
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-test",
        model: "gpt-4o-mini",
      }),
    );
    expect(loadAIPresets().presets.at(-1)?.name).toBe("Mine");
  });
});
