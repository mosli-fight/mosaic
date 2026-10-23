/**
 * Painting a code block.
 *
 * A code block is a card: a dark (or light, in the light theme) rounded
 * rectangle with a header that carries the language and a copy button, and
 * the code below it, coloured by the tokenizer in `@excalidraw/common`.
 *
 * The layout comes from `getCodeBlockLayout`, so the card the canvas paints
 * and the card the SVG exporter paints are the same card. The copy button is
 * not painted here — it is an HTML button in the editor overlay, because a
 * button on a canvas cannot be clicked.
 */

import {
  CODE_BLOCK_FONT_SIZE,
  CODE_BLOCK_RADIUS,
  THEME,
  getCodeBlockLayout,
  tokenizeCode,
} from "@excalidraw/common";

import type {
  CodeBlockLayout,
  CodeToken,
  CodeTokenKind,
} from "@excalidraw/common";

import type { ExcalidrawCodeBlockElement, Theme } from "./types";

/** the code's typeface — the same monospace stack everywhere */
export const CODE_BLOCK_FONT_FAMILY =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

/**
 * The card's colors.
 *
 * A code block is a dark card in both themes — that is what makes code read
 * as code on a whiteboard — but the light theme's card is a touch lighter
 * and its ink a touch darker, so the block sits on the board rather than
 * punching a hole in it.
 */
export const CODE_BLOCK_COLORS = {
  light: {
    background: "#f6f8fa",
    header: "#eaeef2",
    border: "#d0d7de",
    text: "#24292f",
    muted: "#57606a",
  },
  dark: {
    background: "#161b22",
    header: "#21262d",
    border: "#30363d",
    text: "#e6edf3",
    muted: "#8b949e",
  },
} as const;

/** the colour of each kind of token, in each theme */
export const CODE_BLOCK_TOKEN_COLORS: Record<
  Theme,
  Record<CodeTokenKind, string>
> = {
  light: {
    plain: "#24292f",
    keyword: "#cf222e",
    string: "#0a3069",
    number: "#0550ae",
    comment: "#6e7781",
    function: "#8250df",
    punctuation: "#57606a",
    tag: "#116329",
    attribute: "#0550ae",
    property: "#0550ae",
    variable: "#953800",
  },
  dark: {
    plain: "#e6edf3",
    keyword: "#ff7b72",
    string: "#a5d6ff",
    number: "#79c0ff",
    comment: "#8b949e",
    function: "#d2a8ff",
    punctuation: "#8b949e",
    tag: "#7ee787",
    attribute: "#79c0ff",
    property: "#79c0ff",
    variable: "#ffa657",
  },
};

/** the colours of a code block in a theme */
export const getCodeBlockColors = (theme: Theme) => {
  return theme === THEME.DARK
    ? CODE_BLOCK_COLORS.dark
    : CODE_BLOCK_COLORS.light;
};

/**
 * The token colour for a theme.
 *
 * The palette is written for the card's own background, which is the same in
 * both themes — so unlike the rest of the board, the code's colours are *not*
 * run through the dark-mode filter. They are already the dark theme's.
 */
export const getCodeBlockTokenColor = (
  kind: CodeTokenKind,
  theme: Theme,
): string => {
  return (
    CODE_BLOCK_TOKEN_COLORS[theme][kind] ?? CODE_BLOCK_TOKEN_COLORS[theme].plain
  );
};

export type CodeBlockPaintOptions = {
  /** the card's size, which a resize may have changed from the layout's */
  width: number;
  height: number;
  theme: Theme;
};

/**
 * Draws a code block onto a canvas.
 *
 * The context must already be translated to the block's top-left corner and
 * rotated. Everything is drawn in the block's own coordinates.
 */
export const drawCodeBlockOnCanvas = (
  context: CanvasRenderingContext2D,
  element: ExcalidrawCodeBlockElement,
  { width, height, theme }: CodeBlockPaintOptions,
) => {
  const layout = getCodeBlockLayout(element.code);
  const colors = getCodeBlockColors(theme);
  const radius = Math.min(CODE_BLOCK_RADIUS, Math.min(width, height) / 4);

  context.save();

  // the card
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(0, 0, width, height, radius);
  } else {
    context.rect(0, 0, width, height);
  }
  context.fillStyle = colors.background;
  context.fill();

  // the header, clipped to the card so its top corners stay round
  context.save();
  context.clip();
  context.fillStyle = colors.header;
  context.fillRect(0, 0, width, layout.headerHeight);
  context.restore();

  // the rule under the header
  context.beginPath();
  context.moveTo(0, layout.headerHeight);
  context.lineTo(width, layout.headerHeight);
  context.strokeStyle = colors.border;
  context.lineWidth = 1;
  context.stroke();

  // the card's outline
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(0, 0, width, height, radius);
  } else {
    context.rect(0, 0, width, height);
  }
  context.strokeStyle = colors.border;
  context.lineWidth = 1;
  context.stroke();

  // the code, clipped to the card: a long line is cut off by the card's edge
  // rather than crawling out of it
  context.save();
  context.beginPath();
  if (context.roundRect) {
    context.roundRect(0, 0, width, height, radius);
  } else {
    context.rect(0, 0, width, height);
  }
  context.clip();

  context.font = `${CODE_BLOCK_FONT_SIZE}px ${CODE_BLOCK_FONT_FAMILY}`;
  context.textAlign = "left";
  context.textBaseline = "middle";

  const codeTop = layout.headerHeight + layout.padding;
  const tokenized = tokenizeCode(element.code, element.language);

  tokenized.forEach((tokens, lineIndex) => {
    const baseline =
      codeTop + lineIndex * layout.lineHeight + layout.lineHeight / 2;

    // a block is drawn at most as many lines as fit in its card
    if (baseline > height - layout.padding / 2) {
      return;
    }

    let x = layout.padding;
    for (const token of tokens) {
      context.fillStyle = getCodeBlockTokenColor(token.kind, theme);
      context.fillText(token.text, x, baseline);
      x += token.text.length * layout.charWidth;
    }
  });

  context.restore();
  context.restore();
};

/**
 * The runs of a line as SVG text nodes' worth of data.
 *
 * Kept next to the canvas painter so the two cannot drift apart: an exported
 * board shows the same colours as the board it was exported from.
 */
export const getCodeBlockSvgLines = (
  element: ExcalidrawCodeBlockElement,
): { tokens: CodeToken[]; baseline: number }[] => {
  const layout = getCodeBlockLayout(element.code);
  const codeTop = layout.headerHeight + layout.padding;

  return tokenizeCode(element.code, element.language).map(
    (tokens, lineIndex) => ({
      tokens,
      baseline: codeTop + lineIndex * layout.lineHeight + layout.lineHeight / 2,
    }),
  );
};

/** the geometry the SVG exporter needs to draw a block's card */
export const getCodeBlockSvgLayout = (element: ExcalidrawCodeBlockElement) => {
  return getCodeBlockLayout(element.code);
};
