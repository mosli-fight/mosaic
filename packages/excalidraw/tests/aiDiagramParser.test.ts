import { describe, expect, it } from "vitest";

import {
  extractJsonArray,
  parseDiagramElements,
} from "../components/ai/diagramParser";

/**
 * The parser reads what a model answered.
 *
 * A model is asked for a json array and is not trusted to give one back
 * exactly as it was asked for: it may fence it in markdown, wrap it in
 * prose, call a shape something else, or leave a field out. The parser
 * reads what it can and drops what it cannot, and says so when it can
 * read nothing at all.
 */

describe("extractJsonArray", () => {
  it("finds a plain array", () => {
    expect(extractJsonArray('[{"type":"text","x":0,"y":0}]')).toBe(
      '[{"type":"text","x":0,"y":0}]',
    );
  });

  it("finds an array fenced in markdown", () => {
    expect(
      extractJsonArray('```json\n[{"type":"text","x":0,"y":0}]\n```'),
    ).toBe('[{"type":"text","x":0,"y":0}]');
  });

  it("finds an array fenced in markdown without a language", () => {
    expect(extractJsonArray("```\n[1, 2]\n```")).toBe("[1, 2]");
  });

  it("finds an array wrapped in prose", () => {
    expect(
      extractJsonArray(
        'Here you go:\n[{"type":"text","x":1,"y":2}]\nHope it helps.',
      ),
    ).toBe('[{"type":"text","x":1,"y":2}]');
  });

  it("has nothing to find in an answer without an array", () => {
    expect(extractJsonArray("I cannot do that.")).toBe(null);
    expect(extractJsonArray("")).toBe(null);
  });
});

describe("parseDiagramElements", () => {
  it("reads a rectangle with a label", () => {
    expect(
      parseDiagramElements(
        '[{"type":"rectangle","x":10,"y":20,"width":200,"height":100,"text":"Start"}]',
      ),
    ).toEqual([
      {
        kind: "rectangle",
        x: 10,
        y: 20,
        text: "Start",
        width: 200,
        height: 100,
      },
    ]);
  });

  it("reads every kind it knows", () => {
    const parsed = parseDiagramElements(
      JSON.stringify([
        { type: "rectangle", x: 0, y: 0, text: "a" },
        { type: "ellipse", x: 0, y: 100, text: "b" },
        { type: "diamond", x: 0, y: 200, text: "c" },
        { type: "text", x: 0, y: 300, text: "d" },
        { type: "arrow", x: 0, y: 400, x2: 100, y2: 500 },
      ]),
    );

    expect(parsed?.map((element) => element.kind)).toEqual([
      "rectangle",
      "ellipse",
      "diamond",
      "text",
      "arrow",
    ]);
  });

  it("gives a shape a size when the model did not say", () => {
    const parsed = parseDiagramElements('[{"type":"rectangle","x":0,"y":0}]');

    expect(parsed?.[0].width).toBe(160);
    expect(parsed?.[0].height).toBe(80);
  });

  it("reads an arrow's other end", () => {
    const parsed = parseDiagramElements(
      '[{"type":"arrow","x":10,"y":20,"x2":30,"y2":40}]',
    );

    expect(parsed?.[0]).toMatchObject({ x: 10, y: 20, x2: 30, y2: 40 });
  });

  it("gives an arrow a length when the model did not say", () => {
    const parsed = parseDiagramElements('[{"type":"arrow","x":10,"y":20}]');

    expect(parsed?.[0].x2).toBe(130);
    expect(parsed?.[0].y2).toBe(20);
  });

  it("reads a number the model wrote as a string", () => {
    const parsed = parseDiagramElements(
      '[{"type":"rectangle","x":"10","y":"20","text":"Start"}]',
    );

    expect(parsed?.[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("reads a kind the model spelled its own way", () => {
    expect(parseDiagramElements('[{"type":"Box","x":0,"y":0}]')?.[0].kind).toBe(
      "rectangle",
    );
    expect(
      parseDiagramElements('[{"type":"circle","x":0,"y":0}]')?.[0].kind,
    ).toBe("ellipse");
  });

  it("drops an element it cannot place", () => {
    const parsed = parseDiagramElements(
      '[{"type":"rectangle","y":20},{"type":"rectangle","x":10,"y":20}]',
    );

    expect(parsed).toHaveLength(1);
    expect(parsed?.[0]).toMatchObject({ x: 10, y: 20 });
  });

  it("drops an element it does not know", () => {
    const parsed = parseDiagramElements(
      '[{"type":"hexagon","x":0,"y":0},{"type":"rectangle","x":1,"y":2}]',
    );

    expect(parsed).toHaveLength(1);
    expect(parsed?.[0].kind).toBe("rectangle");
  });

  it("keeps what it can when only some of the answer is readable", () => {
    const parsed = parseDiagramElements(
      '[{"type":"rectangle","x":0,"y":0},{"nothing":"useful"},{"type":"text","x":5,"y":5,"text":"hi"}]',
    );

    expect(parsed).toHaveLength(2);
  });

  it("has nothing to say about an answer that is not an array", () => {
    expect(parseDiagramElements("I cannot do that.")).toBe(null);
    expect(parseDiagramElements("[]")).toBe(null);
    expect(parseDiagramElements("[not json]")).toBe(null);
    expect(parseDiagramElements("")).toBe(null);
  });

  it("keeps an absurd coordinate from breaking the board", () => {
    const parsed = parseDiagramElements(
      '[{"type":"rectangle","x":999999999,"y":0}]',
    );

    expect(parsed?.[0].x).toBe(100000);
  });
});
