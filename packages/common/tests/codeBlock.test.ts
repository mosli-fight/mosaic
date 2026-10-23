import {
  CODE_BLOCK_MAX_WIDTH,
  CODE_BLOCK_MIN_HEIGHT,
  CODE_BLOCK_MIN_WIDTH,
  CODE_BLOCK_PADDING,
  CODE_BLOCK_HEADER_HEIGHT,
  CODE_BLOCK_FONT_SIZE,
  CODE_BLOCK_CHAR_WIDTH,
  CODE_BLOCK_LINE_HEIGHT,
  DEFAULT_CODE_BLOCK_CODE,
  DEFAULT_CODE_BLOCK_LANGUAGE,
  CODE_BLOCK_LANGUAGES,
  getCodeBlockLayout,
  getCodeBlockLanguagePreset,
  getCodeBlockLines,
  normalizeCodeBlockLanguage,
  tokenizeCode,
  tokenizeCodeLine,
} from "../src/codeBlock";

describe("the code block model", () => {
  describe("languages", () => {
    it("offers the common presets, plain text first", () => {
      expect(CODE_BLOCK_LANGUAGES[0].id).toBe("plaintext");
      expect(CODE_BLOCK_LANGUAGES.map((preset) => preset.id)).toEqual(
        expect.arrayContaining([
          "javascript",
          "typescript",
          "python",
          "json",
          "html",
          "css",
          "sql",
          "bash",
        ]),
      );
    });

    it("starts in a language it offers", () => {
      expect(
        CODE_BLOCK_LANGUAGES.some(
          (preset) => preset.id === DEFAULT_CODE_BLOCK_LANGUAGE,
        ),
      ).toBe(true);
      expect(DEFAULT_CODE_BLOCK_CODE.length).toBeGreaterThan(0);
    });

    it("normalizes an unknown language to plain text", () => {
      expect(normalizeCodeBlockLanguage("javascript")).toBe("javascript");
      // a language from a newer editor, or a corrupt file
      expect(normalizeCodeBlockLanguage("brainfuck")).toBe("plaintext");
      expect(normalizeCodeBlockLanguage(undefined)).toBe("plaintext");
      expect(normalizeCodeBlockLanguage(42)).toBe("plaintext");
    });

    it("resolves a preset by id, falling back to plain text", () => {
      expect(getCodeBlockLanguagePreset("python").label).toBe("Python");
      expect(getCodeBlockLanguagePreset("nope").id).toBe("plaintext");
    });
  });

  describe("lines", () => {
    it("splits on newlines, whatever the line ending", () => {
      expect(getCodeBlockLines("a\nb")).toEqual(["a", "b"]);
      expect(getCodeBlockLines("a\r\nb")).toEqual(["a", "b"]);
      expect(getCodeBlockLines("a\rb")).toEqual(["a", "b"]);
    });

    it("expands tabs to four spaces", () => {
      expect(getCodeBlockLines("\tx")).toEqual(["    x"]);
    });
  });

  describe("layout", () => {
    it("sizes a card around its code", () => {
      const layout = getCodeBlockLayout("const x = 1;");
      const expectedWidth =
        "const x = 1;".length * CODE_BLOCK_FONT_SIZE * CODE_BLOCK_CHAR_WIDTH +
        CODE_BLOCK_PADDING * 2;

      expect(layout.width).toBe(Math.max(CODE_BLOCK_MIN_WIDTH, expectedWidth));
      expect(layout.height).toBeGreaterThanOrEqual(CODE_BLOCK_MIN_HEIGHT);
    });

    it("never gets narrower than the minimum, however short the code", () => {
      expect(getCodeBlockLayout("").width).toBe(CODE_BLOCK_MIN_WIDTH);
      expect(getCodeBlockLayout("x").width).toBe(CODE_BLOCK_MIN_WIDTH);
    });

    it("never gets wider than the maximum, however long the line", () => {
      const layout = getCodeBlockLayout("x".repeat(5000));
      expect(layout.width).toBe(CODE_BLOCK_MAX_WIDTH);
    });

    it("grows taller with each line", () => {
      // past the minimum height, so the growth is the lines' own
      const five = getCodeBlockLayout("a\nb\nc\nd\ne");
      const seven = getCodeBlockLayout("a\nb\nc\nd\ne\nf\ng");
      const lineHeight = CODE_BLOCK_FONT_SIZE * CODE_BLOCK_LINE_HEIGHT;

      expect(seven.height - five.height).toBeCloseTo(lineHeight * 2, 5);
    });

    it("keeps a header above the code", () => {
      const layout = getCodeBlockLayout("");
      expect(layout.headerHeight).toBe(CODE_BLOCK_HEADER_HEIGHT);
      expect(layout.height).toBeGreaterThan(
        layout.headerHeight + CODE_BLOCK_PADDING,
      );
    });
  });

  describe("the tokenizer", () => {
    const kinds = (code: string, language: string) =>
      tokenizeCode(code, language).map((line) =>
        line.map((token) => [token.text, token.kind]),
      );

    it("colours a keyword and a string in javascript", () => {
      expect(kinds('const x = "hi";', "javascript")).toEqual([
        [
          ["const", "keyword"],
          // the space, the name and the space around it are one plain run
          [" x ", "plain"],
          ["=", "punctuation"],
          [" ", "plain"],
          ['"hi"', "string"],
          [";", "punctuation"],
        ],
      ]);
    });

    it("colours a call as a function", () => {
      const tokens = tokenizeCode("greet(name)", "javascript")[0];
      expect(tokens[0]).toEqual({ text: "greet", kind: "function" });
    });

    it("does not colour if as a call", () => {
      const tokens = tokenizeCode("if (x)", "javascript")[0];
      expect(tokens[0]).toEqual({ text: "if", kind: "keyword" });
    });

    it("colours a line comment to the end of the line", () => {
      const tokens = tokenizeCode("x // one\ny", "javascript");
      expect(tokens[0].slice(-1)[0]).toEqual({
        text: "// one",
        kind: "comment",
      });
      // the comment does not leak onto the next line
      expect(tokens[1][0]).toEqual({ text: "y", kind: "plain" });
    });

    it("carries a block comment across lines", () => {
      const tokens = tokenizeCode("/* a\nb */ c", "javascript");
      expect(tokens[0]).toEqual([{ text: "/* a", kind: "comment" }]);
      expect(tokens[1][0]).toEqual({ text: "b */", kind: "comment" });
      expect(tokens[1].slice(-1)[0]).toEqual({ text: " c", kind: "plain" });
    });

    it("colours a python comment and keyword", () => {
      const tokens = tokenizeCode("def f(): # hi", "python")[0];
      expect(tokens[0]).toEqual({ text: "def", kind: "keyword" });
      expect(tokens.slice(-1)[0]).toEqual({ text: "# hi", kind: "comment" });
    });

    it("colours markup tags and attributes", () => {
      const tokens = tokenizeCode('<a href="x">y</a>', "html")[0];
      expect(tokens[0]).toEqual({ text: "<a", kind: "tag" });
      expect(tokens).toEqual(
        expect.arrayContaining([
          { text: "href", kind: "attribute" },
          { text: '"x"', kind: "string" },
        ]),
      );
    });

    it("colours sql keywords case-insensitively", () => {
      const tokens = tokenizeCode("SELECT * FROM t", "sql")[0];
      expect(tokens[0]).toEqual({ text: "SELECT", kind: "keyword" });
      expect(tokens).toEqual(
        expect.arrayContaining([{ text: "FROM", kind: "keyword" }]),
      );
    });

    it("leaves plain text alone", () => {
      expect(tokenizeCode("const x = 1", "plaintext")).toEqual([
        [{ text: "const x = 1", kind: "plain" }],
      ]);
    });

    it("keeps every character of the code, whatever it colours", () => {
      const code = "function f(a) {\n  return `x ${a}`; // done\n}";
      const rebuilt = tokenizeCode(code, "javascript")
        .map((line) => line.map((token) => token.text).join(""))
        .join("\n");
      expect(rebuilt).toBe(code);
    });

    it("returns no tokens for an empty line", () => {
      expect(tokenizeCodeLine("", "javascript").tokens).toEqual([]);
    });
  });
});
