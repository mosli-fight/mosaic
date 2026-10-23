import { describe, expect, it } from "vitest";

import {
  buildBoardSummary,
  buildChatMessages,
  buildDiagramMessages,
  buildSummaryMessages,
  withPresetRules,
} from "../components/ai/prompts";

/**
 * What the model is told.
 *
 * The system prompt is where the user's preset rules end up, so these tests
 * are about the composition: the built-in instructions, then the user's
 * rules, then the board — and the same request as before when no preset is
 * applied.
 */

const RULES = "Use British spelling. Keep labels under four words.";

const systemOf = (messages: { role: string; content: string }[]) =>
  messages.find((message) => message.role === "system")?.content ?? "";

describe("withPresetRules", () => {
  it("adds the rules after the built-in instructions", () => {
    const composed = withPresetRules("Base instructions.", RULES);

    expect(composed.startsWith("Base instructions.")).toBe(true);
    expect(composed).toContain(RULES);
    expect(composed.indexOf("Base instructions.")).toBeLessThan(
      composed.indexOf(RULES),
    );
  });

  it("changes nothing when there are no rules", () => {
    expect(withPresetRules("Base.", "")).toBe("Base.");
    expect(withPresetRules("Base.", "   ")).toBe("Base.");
    expect(withPresetRules("Base.", null)).toBe("Base.");
    expect(withPresetRules("Base.", undefined)).toBe("Base.");
  });
});

describe("buildDiagramMessages", () => {
  it("is unchanged when no preset is applied", () => {
    const withoutParam = buildDiagramMessages({
      prompt: "A login flow",
      boardSummary: "",
    });
    const withNull = buildDiagramMessages({
      prompt: "A login flow",
      boardSummary: "",
      presetRules: null,
    });

    expect(withNull).toEqual(withoutParam);
  });

  it("puts the applied preset's rules in the system prompt", () => {
    const messages = buildDiagramMessages({
      prompt: "A login flow",
      boardSummary: "",
      presetRules: RULES,
    });

    expect(systemOf(messages)).toContain(RULES);
    expect(messages.at(-1)).toEqual({ role: "user", content: "A login flow" });
  });

  it("keeps the output contract, the rules and the board, in that order", () => {
    const messages = buildDiagramMessages({
      prompt: "A login flow",
      boardSummary: "3 elements on the board: rectangles.",
      presetRules: RULES,
    });

    const system = systemOf(messages);

    expect(system.indexOf("JSON array")).toBeLessThan(system.indexOf(RULES));
    expect(system.indexOf(RULES)).toBeLessThan(
      system.indexOf("3 elements on the board"),
    );
  });
});

describe("buildChatMessages", () => {
  it("puts the applied preset's rules in the system prompt", () => {
    const messages = buildChatMessages({
      history: [{ role: "user", content: "Hi" }],
      userText: "What is this?",
      boardSummary: "",
      presetRules: RULES,
    });

    expect(systemOf(messages)).toContain(RULES);
    expect(messages.at(-1)).toEqual({ role: "user", content: "What is this?" });
  });

  it("is unchanged when no preset is applied", () => {
    expect(
      buildChatMessages({
        history: [],
        userText: "Hi",
        boardSummary: "",
        presetRules: "",
      }),
    ).toEqual(
      buildChatMessages({ history: [], userText: "Hi", boardSummary: "" }),
    );
  });
});

describe("buildSummaryMessages", () => {
  it("puts the applied preset's rules in the system prompt", () => {
    const messages = buildSummaryMessages({
      boardSummary: "1 element on the board: rectangles.",
      presetRules: RULES,
    });

    expect(systemOf(messages)).toContain(RULES);
  });
});

describe("buildBoardSummary", () => {
  it("has nothing to say about an empty board", () => {
    expect(buildBoardSummary([])).toBe("");
  });
});
