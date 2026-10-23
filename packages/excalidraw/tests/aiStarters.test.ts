import { describe, expect, it } from "vitest";

import { parseDiagramElements } from "../components/ai/diagramParser";
import { DIAGRAM_STARTERS } from "../components/ai/starters";

/**
 * The diagram-type starters.
 *
 * A starter is a prompt, not a request: it is put in the composer for the
 * person to edit. What makes it worth having is that the model it is sent to
 * is told the exact output shape the panel parses — so these tests check
 * that promise, by running each starter's own worked example through the
 * real parser.
 */

describe("the starters", () => {
  it("covers every diagram type the panel offers", () => {
    expect(DIAGRAM_STARTERS.map((starter) => starter.id)).toEqual([
      "architecture",
      "flowchart",
      "erd",
      "sequence",
      "bpmn",
      "document",
    ]);
  });

  it("gives every starter a unique label key", () => {
    const keys = DIAGRAM_STARTERS.map((starter) => starter.labelKey);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every starter one to three examples", () => {
    for (const starter of DIAGRAM_STARTERS) {
      expect(starter.examples.length).toBeGreaterThanOrEqual(1);
      expect(starter.examples.length).toBeLessThanOrEqual(3);

      for (const example of starter.examples) {
        expect(example.trim()).not.toBe("");
      }
    }
  });

  it("tells the model the output contract the parser reads", () => {
    for (const starter of DIAGRAM_STARTERS) {
      expect(starter.prompt).toContain("JSON array");
      expect(starter.prompt).toContain('"type"');
      expect(starter.prompt).toContain('"x"');
      expect(starter.prompt).toContain('"y"');
    }
  });

  it("ships a worked example that the parser can actually read", () => {
    for (const starter of DIAGRAM_STARTERS) {
      const specs = parseDiagramElements(starter.prompt);

      expect(specs, `${starter.id} has no parseable example`).not.toBe(null);
      expect(specs!.length).toBeGreaterThan(1);
    }
  });

  it("puts the example after the instructions, so the model reads it last", () => {
    for (const starter of DIAGRAM_STARTERS) {
      expect(starter.prompt.indexOf("Example:")).toBeGreaterThan(
        starter.prompt.indexOf("JSON array"),
      );
    }
  });
});
