/**
 * Text measurement for a process with no canvas.
 *
 * ## Why this module has to exist
 *
 * The element constructors measure text to decide how wide a text element is,
 * how a label wraps, and how a sticky note grows to fit its body. The default
 * provider does that with `canvas.measureText`, which means `document` — and a
 * stdio server has no document. Without a provider, the first `add_element`
 * call throws `document is not defined`.
 *
 * `setCustomTextMetricsProvider` is the editor's own injection point for
 * exactly this case ("where canvas API is not available / desired"), so this
 * module installs one rather than reimplementing any geometry.
 *
 * ## What the approximation costs, stated plainly
 *
 * There is no font rasteriser here, so the advance width of a glyph is
 * estimated from its character class. That is not the browser's answer, and it
 * cannot be: the browser knows the actual font file.
 *
 * It matters more than it would in a browser, because the app does **not**
 * re-measure stored text when it opens a board (`restoreElements` is called
 * without `refreshDimensions` in `excalidraw-app/App.tsx`). Whatever width
 * this module computes is the width the editor draws and selects against.
 *
 * So the estimate is deliberately generous: an element that is a little too
 * wide has slack to its right, while one that is too narrow has its text
 * spilling past its own selection box and over its neighbours. Every class
 * below rounds up rather than down.
 *
 * Heights do not depend on this at all — they come from the font's line height,
 * which `measureText` derives from `fontSize × lineHeight`.
 */

import { getFontSizeFromFontString } from "@excalidraw/common";
import { setCustomTextMetricsProvider } from "@excalidraw/element";

/** Used when a font shorthand carries no readable size. */
const FALLBACK_FONT_SIZE = 16;

/**
 * Characters that are narrower than the default in every proportional face.
 *
 * Kept as a string rather than a `Set` of code points because it is read as a
 * list: these are the glyphs whose side bearings dominate their ink.
 */
const NARROW = "iljtfrI.,:;'`|![](){}";

/** Characters that are noticeably wider than the default. */
const WIDE = "mwMW@%&";

/** Whether a code point belongs to a script whose glyphs are full-width. */
const isFullWidth = (codePoint: number): boolean =>
  // CJK unified ideographs, kana, hangul and the full-width forms. The block
  // start is 0x2e80 (CJK radicals); everything from there up is drawn at
  // roughly one em per glyph.
  codePoint >= 0x2e80;

/**
 * The advance width of one character, in ems.
 *
 * The numbers are the usual rough proportions for a humanist sans (Helvetica,
 * Arial, the system stack): lowercase averages near 0.55em, capitals are
 * wider, and the narrow set is about half that. They are estimates, and the
 * module comment explains why they lean high.
 */
const advanceInEms = (char: string): number => {
  const codePoint = char.codePointAt(0) ?? 0;

  if (char === " ") {
    return 0.28;
  }
  if (isFullWidth(codePoint)) {
    return 1;
  }
  if (char >= "A" && char <= "Z") {
    return 0.68;
  }
  if (char >= "0" && char <= "9") {
    return 0.55;
  }
  if (NARROW.includes(char)) {
    return 0.3;
  }
  if (WIDE.includes(char)) {
    return 0.85;
  }
  return 0.55;
};

/** The width of one rendered line, in pixels. */
export const estimateLineWidth = (text: string, fontSize: number): number => {
  let width = 0;
  // `for...of` iterates code points, so a surrogate pair counts as one glyph
  // rather than two half-width units.
  for (const char of text) {
    width += advanceInEms(char) * fontSize;
  }
  return width;
};

/**
 * Installs the estimator as the editor's text metrics provider.
 *
 * Process-wide and irreversible: `setCustomTextMetricsProvider` has no "unset".
 * That is fine here — this process does nothing but serve MCP tool calls, and
 * every element it builds wants the same measurement.
 */
export const installTextMetrics = (): void => {
  setCustomTextMetricsProvider({
    getLineWidth: (text, font) => {
      const size = getFontSizeFromFontString(font);
      return estimateLineWidth(
        text,
        Number.isFinite(size) ? size : FALLBACK_FONT_SIZE,
      );
    },
  });
};

/**
 * Installs the estimator once, at module load.
 *
 * Every module that builds an element imports this for the side effect, so it
 * does not matter which of them a caller reaches first — `diagram.ts` alone is
 * enough, and so is `sceneEdit.ts`. Installing it from one of them only would
 * make the other crash with `document is not defined` the first time it
 * measured a label, which is a confusing way to learn about an import order.
 *
 * Idempotent and cheap: `setCustomTextMetricsProvider` stores the object, and
 * a second identical install replaces it with an equivalent one.
 */
installTextMetrics();
