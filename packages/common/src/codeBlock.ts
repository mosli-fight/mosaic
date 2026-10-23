/**
 * The code block: the languages it can hold, the layout of the card it is
 * drawn as, and the tokenizer that colours it.
 *
 * All of this is pure — it imports nothing and it measures nothing — so that
 * the canvas renderer, the SVG exporter, the editor overlay and the tests
 * all agree on what a code block looks like without any of them having to
 * ask a browser. The width of a line is estimated from the monospace
 * advance, which is exact enough for a card that is laid out around its
 * text and is the same at every zoom.
 */

/** the languages the language picker offers */
export type CodeBlockLanguage =
  | "plaintext"
  | "javascript"
  | "typescript"
  | "python"
  | "json"
  | "html"
  | "css"
  | "sql"
  | "bash";

export type CodeBlockLanguagePreset = {
  id: CodeBlockLanguage;
  /** the name shown on the block's header and in the picker */
  label: string;
  /** how the tokenizer reads the language */
  grammar: CodeBlockGrammar;
};

/** the tokenizer's dialect: which comments, strings and keywords to expect */
export type CodeBlockGrammar =
  | "plaintext"
  | "javascript"
  | "python"
  | "json"
  | "markup"
  | "css"
  | "sql"
  | "shell";

/** the languages, in the order the picker lists them */
export const CODE_BLOCK_LANGUAGES: readonly CodeBlockLanguagePreset[] = [
  { id: "plaintext", label: "Plain text", grammar: "plaintext" },
  { id: "javascript", label: "JavaScript", grammar: "javascript" },
  { id: "typescript", label: "TypeScript", grammar: "javascript" },
  { id: "python", label: "Python", grammar: "python" },
  { id: "json", label: "JSON", grammar: "json" },
  { id: "html", label: "HTML", grammar: "markup" },
  { id: "css", label: "CSS", grammar: "css" },
  { id: "sql", label: "SQL", grammar: "sql" },
  { id: "bash", label: "Bash", grammar: "shell" },
];

/** the language a fresh block starts in */
export const DEFAULT_CODE_BLOCK_LANGUAGE: CodeBlockLanguage = "javascript";

/** the code a fresh block starts with */
export const DEFAULT_CODE_BLOCK_CODE = `function greet(name) {
  return \`Hello, \${name}!\`;
}`;

/**
 * Normalizes a language id that came from a file (or from a newer version of
 * the editor) to one we know, falling back to plain text.
 */
export const normalizeCodeBlockLanguage = (
  language: unknown,
): CodeBlockLanguage => {
  if (typeof language !== "string") {
    return "plaintext";
  }
  return (
    CODE_BLOCK_LANGUAGES.find((preset) => preset.id === language)?.id ??
    "plaintext"
  );
};

/** the preset for a language id */
export const getCodeBlockLanguagePreset = (
  language: CodeBlockLanguage | string,
): CodeBlockLanguagePreset => {
  return (
    CODE_BLOCK_LANGUAGES.find((preset) => preset.id === language) ??
    CODE_BLOCK_LANGUAGES[0]
  );
};

// ---------------------------------------------------------------------------
// The card's layout
// ---------------------------------------------------------------------------

/** the size of the code, in scene units */
export const CODE_BLOCK_FONT_SIZE = 14;
/** the line height, as a multiple of the font size */
export const CODE_BLOCK_LINE_HEIGHT = 1.5;
/** the monospace advance, as a fraction of the font size */
export const CODE_BLOCK_CHAR_WIDTH = 0.6;
/** the room inside the card, around the code */
export const CODE_BLOCK_PADDING = 16;
/** the height of the header that carries the language and the copy button */
export const CODE_BLOCK_HEADER_HEIGHT = 34;
/** the narrowest a block gets, however short its code */
export const CODE_BLOCK_MIN_WIDTH = 320;
/** the widest a block gets before its long lines are clipped */
export const CODE_BLOCK_MAX_WIDTH = 900;
/** the shortest a block gets, however few its lines */
export const CODE_BLOCK_MIN_HEIGHT = 120;
/** the corner radius of the card */
export const CODE_BLOCK_RADIUS = 8;

export type CodeBlockLayout = {
  /** the width of the card, in scene units */
  width: number;
  /** the height of the card, in scene units */
  height: number;
  /** the height of the header, in scene units */
  headerHeight: number;
  /** the room inside the card, in scene units */
  padding: number;
  /** the distance between two baselines, in scene units */
  lineHeight: number;
  /** the width of one monospace character, in scene units */
  charWidth: number;
  /** the lines of code, with their tabs expanded */
  lines: string[];
  /** the widest line, in characters */
  longestLine: number;
};

/** the lines of a piece of code, with tabs expanded to spaces */
export const getCodeBlockLines = (code: string): string[] => {
  return code
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "    "));
};

/**
 * The layout of a code block: the card it is drawn as and the metrics the
 * code is drawn with.
 *
 * The card is sized around its code — a block grows as its content grows —
 * within bounds that keep it readable: never narrower than a short line,
 * never wider than a readable column (a longer line is clipped rather than
 * making the card crawl across the board), and never shorter than a card
 * with a header and a couple of lines.
 */
export const getCodeBlockLayout = (code: string): CodeBlockLayout => {
  const lines = getCodeBlockLines(code);
  const longestLine = lines.reduce(
    (longest, line) => Math.max(longest, line.length),
    0,
  );

  const charWidth = CODE_BLOCK_FONT_SIZE * CODE_BLOCK_CHAR_WIDTH;
  const lineHeight = CODE_BLOCK_FONT_SIZE * CODE_BLOCK_LINE_HEIGHT;

  const contentWidth = Math.ceil(longestLine * charWidth);
  const width = Math.min(
    CODE_BLOCK_MAX_WIDTH,
    Math.max(CODE_BLOCK_MIN_WIDTH, contentWidth + CODE_BLOCK_PADDING * 2),
  );

  const contentHeight = Math.ceil(lines.length * lineHeight);
  const height = Math.max(
    CODE_BLOCK_MIN_HEIGHT,
    CODE_BLOCK_HEADER_HEIGHT + CODE_BLOCK_PADDING * 2 + contentHeight,
  );

  return {
    width,
    height,
    headerHeight: CODE_BLOCK_HEADER_HEIGHT,
    padding: CODE_BLOCK_PADDING,
    lineHeight,
    charWidth,
    lines,
    longestLine,
  };
};

// ---------------------------------------------------------------------------
// The tokenizer
// ---------------------------------------------------------------------------

/**
 * What a run of code is, for colouring.
 *
 * The kinds are deliberately few: a whiteboard wants code that reads as
 * code, not a theme for every dialect. The renderer maps each kind to a
 * colour, and each theme has its own palette.
 */
export type CodeTokenKind =
  | "plain"
  | "keyword"
  | "string"
  | "number"
  | "comment"
  | "function"
  | "punctuation"
  | "tag"
  | "attribute"
  | "property"
  | "variable";

export type CodeToken = {
  text: string;
  kind: CodeTokenKind;
};

type GrammarRules = {
  lineComment: string | null;
  blockComment: [string, string] | null;
  strings: readonly string[];
  keywords: ReadonlySet<string>;
  /** whether a `name(` is a call worth colouring */
  calls: boolean;
};

const JS_KEYWORDS = new Set([
  "const",
  "let",
  "var",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "break",
  "continue",
  "new",
  "class",
  "extends",
  "super",
  "this",
  "import",
  "export",
  "from",
  "default",
  "async",
  "await",
  "try",
  "catch",
  "finally",
  "throw",
  "typeof",
  "instanceof",
  "in",
  "of",
  "null",
  "undefined",
  "true",
  "false",
  "void",
  "yield",
  "delete",
  "interface",
  "type",
  "enum",
  "implements",
  "public",
  "private",
  "protected",
  "readonly",
  "as",
  "satisfies",
]);

const PYTHON_KEYWORDS = new Set([
  "def",
  "class",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "in",
  "not",
  "and",
  "or",
  "is",
  "None",
  "True",
  "False",
  "import",
  "from",
  "as",
  "with",
  "try",
  "except",
  "finally",
  "raise",
  "pass",
  "break",
  "continue",
  "lambda",
  "yield",
  "global",
  "nonlocal",
  "assert",
  "del",
  "async",
  "await",
  "self",
]);

const SQL_KEYWORDS = new Set(
  [
    "select",
    "from",
    "where",
    "insert",
    "into",
    "values",
    "update",
    "set",
    "delete",
    "create",
    "table",
    "drop",
    "alter",
    "add",
    "join",
    "left",
    "right",
    "inner",
    "outer",
    "on",
    "group",
    "by",
    "order",
    "having",
    "limit",
    "offset",
    "as",
    "and",
    "or",
    "not",
    "null",
    "is",
    "in",
    "like",
    "between",
    "distinct",
    "count",
    "sum",
    "avg",
    "min",
    "max",
    "union",
    "all",
    "primary",
    "key",
    "foreign",
    "references",
    "index",
    "default",
    "case",
    "when",
    "then",
    "else",
    "end",
  ].map((keyword) => keyword.toLowerCase()),
);

const SHELL_KEYWORDS = new Set([
  "if",
  "then",
  "else",
  "elif",
  "fi",
  "for",
  "while",
  "do",
  "done",
  "case",
  "esac",
  "function",
  "return",
  "export",
  "local",
  "echo",
  "cd",
  "exit",
  "set",
  "source",
]);

const CSS_KEYWORDS = new Set([
  "important",
  "inherit",
  "initial",
  "unset",
  "none",
  "auto",
  "flex",
  "grid",
  "block",
  "inline",
  "absolute",
  "relative",
  "fixed",
  "sticky",
  "transparent",
]);

const JSON_KEYWORDS = new Set(["true", "false", "null"]);

const RULES: Record<CodeBlockGrammar, GrammarRules> = {
  plaintext: {
    lineComment: null,
    blockComment: null,
    strings: [],
    keywords: new Set(),
    calls: false,
  },
  javascript: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
    strings: ['"', "'", "`"],
    keywords: JS_KEYWORDS,
    calls: true,
  },
  python: {
    lineComment: "#",
    blockComment: null,
    strings: ['"', "'"],
    keywords: PYTHON_KEYWORDS,
    calls: true,
  },
  json: {
    lineComment: null,
    blockComment: null,
    strings: ['"'],
    keywords: JSON_KEYWORDS,
    calls: false,
  },
  markup: {
    lineComment: null,
    blockComment: ["<!--", "-->"],
    strings: ['"', "'"],
    keywords: new Set(),
    calls: false,
  },
  css: {
    lineComment: null,
    blockComment: ["/*", "*/"],
    strings: ['"', "'"],
    keywords: CSS_KEYWORDS,
    calls: false,
  },
  sql: {
    lineComment: "--",
    blockComment: ["/*", "*/"],
    strings: ["'", '"'],
    keywords: SQL_KEYWORDS,
    calls: false,
  },
  shell: {
    lineComment: "#",
    blockComment: null,
    strings: ['"', "'"],
    keywords: SHELL_KEYWORDS,
    calls: false,
  },
};

const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[A-Za-z0-9_$-]/;
const DIGIT = /[0-9]/;

/**
 * Splits one line of code into coloured runs.
 *
 * The tokenizer is deliberately small: it knows comments, strings, numbers,
 * keywords and calls, which is what makes code *read* as code on a
 * whiteboard. It is not a parser, and it never needs to be — a token that is
 * misread is still drawn in the right font, in the right place.
 *
 * Block comments that span lines are handled by the caller passing
 * `inBlockComment`, which the function returns to carry the state to the
 * next line.
 */
export const tokenizeCodeLine = (
  line: string,
  grammar: CodeBlockGrammar,
  inBlockComment = false,
): { tokens: CodeToken[]; inBlockComment: boolean } => {
  const rules = RULES[grammar] ?? RULES.plaintext;
  const tokens: CodeToken[] = [];

  if (grammar === "plaintext") {
    return {
      tokens: line ? [{ text: line, kind: "plain" }] : [],
      inBlockComment,
    };
  }

  if (grammar === "markup") {
    return tokenizeMarkupLine(line, rules, inBlockComment);
  }

  let index = 0;
  let block = inBlockComment;

  const push = (text: string, kind: CodeTokenKind) => {
    if (!text) {
      return;
    }
    const previous = tokens[tokens.length - 1];
    if (previous && previous.kind === kind) {
      tokens[tokens.length - 1] = {
        text: previous.text + text,
        kind: previous.kind,
      };
      return;
    }
    tokens.push({ text, kind });
  };

  while (index < line.length) {
    const rest = line.slice(index);

    // the tail of a block comment that started on an earlier line
    if (block) {
      const close = rules.blockComment?.[1];
      const end = close ? rest.indexOf(close) : -1;
      if (end === -1) {
        push(rest, "comment");
        return { tokens, inBlockComment: true };
      }
      push(rest.slice(0, end + close!.length), "comment");
      index += end + close!.length;
      block = false;
      continue;
    }

    if (rules.blockComment && rest.startsWith(rules.blockComment[0])) {
      const [open, close] = rules.blockComment;
      const end = rest.indexOf(close, open.length);
      if (end === -1) {
        push(rest, "comment");
        return { tokens, inBlockComment: true };
      }
      push(rest.slice(0, end + close.length), "comment");
      index += end + close.length;
      continue;
    }

    if (rules.lineComment && rest.startsWith(rules.lineComment)) {
      push(rest, "comment");
      return { tokens, inBlockComment: false };
    }

    const char = rest[0];

    if (rules.strings.includes(char)) {
      // a string runs to its closing quote, honouring backslash escapes; an
      // unterminated one runs to the end of the line
      let cursor = 1;
      while (cursor < rest.length) {
        if (rest[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (rest[cursor] === char) {
          cursor += 1;
          break;
        }
        cursor += 1;
      }
      push(rest.slice(0, cursor), "string");
      index += cursor;
      continue;
    }

    if (DIGIT.test(char)) {
      let cursor = 1;
      while (cursor < rest.length && /[0-9a-fA-FxX._]/.test(rest[cursor])) {
        cursor += 1;
      }
      push(rest.slice(0, cursor), "number");
      index += cursor;
      continue;
    }

    if (IDENTIFIER_START.test(char)) {
      let cursor = 1;
      while (cursor < rest.length && IDENTIFIER_PART.test(rest[cursor])) {
        cursor += 1;
      }
      const word = rest.slice(0, cursor);
      const isKeyword = rules.keywords.has(
        grammar === "sql" ? word.toLowerCase() : word,
      );
      const isCall =
        rules.calls && rest[cursor] === "(" && !isKeyword && word !== "if";

      push(word, isKeyword ? "keyword" : isCall ? "function" : "plain");
      index += cursor;
      continue;
    }

    if (/[{}()[\];,.:=+\-*/%<>!&|?^~@#]/.test(char)) {
      push(char, "punctuation");
      index += 1;
      continue;
    }

    push(char, "plain");
    index += 1;
  }

  return { tokens, inBlockComment: false };
};

/**
 * Markup is not tokenized the way code is: the interesting parts are the
 * tags and their attributes, and everything between them is text.
 */
const tokenizeMarkupLine = (
  line: string,
  rules: GrammarRules,
  inBlockComment: boolean,
): { tokens: CodeToken[]; inBlockComment: boolean } => {
  const tokens: CodeToken[] = [];
  let index = 0;
  let block = inBlockComment;

  const push = (text: string, kind: CodeTokenKind) => {
    if (!text) {
      return;
    }
    const previous = tokens[tokens.length - 1];
    if (previous && previous.kind === kind) {
      tokens[tokens.length - 1] = {
        text: previous.text + text,
        kind: previous.kind,
      };
      return;
    }
    tokens.push({ text, kind });
  };

  while (index < line.length) {
    const rest = line.slice(index);

    if (block) {
      const end = rest.indexOf("-->");
      if (end === -1) {
        push(rest, "comment");
        return { tokens, inBlockComment: true };
      }
      push(rest.slice(0, end + 3), "comment");
      index += end + 3;
      block = false;
      continue;
    }

    if (rest.startsWith("<!--")) {
      const end = rest.indexOf("-->", 4);
      if (end === -1) {
        push(rest, "comment");
        return { tokens, inBlockComment: true };
      }
      push(rest.slice(0, end + 3), "comment");
      index += end + 3;
      continue;
    }

    if (rest.startsWith("</") || rest.startsWith("<")) {
      // the tag's name, then its attributes up to the closing bracket
      const end = rest.indexOf(">");
      const tag = end === -1 ? rest : rest.slice(0, end + 1);

      const nameMatch = tag.match(/^<\/?\s*([A-Za-z][\w:-]*)/);
      if (nameMatch) {
        push(tag.slice(0, nameMatch[0].length), "tag");
        let cursor = nameMatch[0].length;
        const attributePattern =
          /(\s+)([A-Za-z_:][\w:.-]*)(\s*=\s*)?("[^"]*"|'[^']*')?/g;
        attributePattern.lastIndex = 0;
        const body = tag.slice(cursor);
        let match: RegExpExecArray | null;
        let consumed = 0;
        while ((match = attributePattern.exec(body)) !== null) {
          if (match.index !== consumed) {
            break;
          }
          push(match[1], "plain");
          push(match[2], "attribute");
          if (match[3]) {
            push(match[3], "punctuation");
          }
          if (match[4]) {
            push(match[4], "string");
          }
          consumed = match.index + match[0].length;
        }
        cursor += consumed;
        push(tag.slice(cursor), "punctuation");
      } else {
        push(tag, "punctuation");
      }

      index += tag.length;
      continue;
    }

    // text between tags
    const nextTag = rest.indexOf("<");
    if (nextTag === -1) {
      push(rest, "plain");
      index = line.length;
    } else {
      push(rest.slice(0, nextTag), "plain");
      index += nextTag;
    }
  }

  return { tokens, inBlockComment: false };
};

/**
 * Splits a whole block of code into coloured lines.
 *
 * The block-comment state is carried from line to line, so a comment that
 * spans several lines is coloured as one comment rather than as code that
 * happens to start with `*`.
 */
export const tokenizeCode = (
  code: string,
  language: CodeBlockLanguage | string,
): CodeToken[][] => {
  const grammar = getCodeBlockLanguagePreset(language).grammar;
  const lines = getCodeBlockLines(code);

  let inBlockComment = false;

  return lines.map((line) => {
    const result = tokenizeCodeLine(line, grammar, inBlockComment);
    inBlockComment = result.inBlockComment;
    return result.tokens;
  });
};
