/**
 * The Miro-style sticky note vocabulary: the fill palette, the size presets
 * and the typography steps the sticky note properties panel offers.
 *
 * Kept in `@excalidraw/common` because both the element package (which paints
 * and lays out a note) and the editor package (which offers the controls)
 * need to agree on them — the fill a swatch shows and the fill the note ends
 * up with must be the same string.
 *
 * NOTE: this module imports nothing. `./colors` reads the default fill from
 * here, and `./constants` reads the tag row height from here, so a
 * dependency in either direction would be a cycle. The sticky note *geometry*
 * constants (padding, footer, body inset) live in `./constants` instead.
 */

/**
 * A hue in the sticky note palette, in its light and dark variant.
 *
 * The two-element form is intentional: a sticky note's fill is a *paper*
 * color, and Miro offers exactly two paper shades per hue. It is a
 * `readonly [string, string]` rather than a `ColorTuple` because the
 * five-shade tuple is the element-color idiom, and a note has no business
 * borrowing it.
 */
export type StickyNoteHue = readonly [light: string, dark: string];

export type StickyNoteHueName =
  | "yellow"
  | "orange"
  | "red"
  | "pink"
  | "violet"
  | "blue"
  | "cyan"
  | "green";

/**
 * The eight sticky note hues, each in a light and a dark variant — the
 * sixteen fills a Miro sticky note offers.
 *
 * ORDER matters: it is the order the swatches appear in the properties
 * panel and in the color picker's base row.
 *
 * The light yellow is `DEFAULT_STICKY_NOTE_BG` — the fill every fresh note
 * gets — so the default note keeps the color it has always had. That
 * constant is derived from this table, which is why the value is spelled out
 * here rather than imported.
 */
export const STICKY_NOTE_HUES: Record<StickyNoteHueName, StickyNoteHue> = {
  yellow: ["#ffdf6b", "#f2c94c"],
  orange: ["#ffd6ad", "#f2994a"],
  red: ["#ffc9c9", "#eb5757"],
  pink: ["#f7c8e3", "#d45087"],
  violet: ["#d9c8f5", "#9b51e0"],
  blue: ["#c3ddf7", "#2f80ed"],
  cyan: ["#bfe6e0", "#26a69a"],
  green: ["#c6e8b3", "#27ae60"],
};

/** the hue names, in palette order */
export const STICKY_NOTE_HUE_NAMES = Object.keys(
  STICKY_NOTE_HUES,
) as StickyNoteHueName[];

/**
 * The sixteen fills, flattened: every hue's light variant first, then every
 * hue's dark variant. The order is the order the swatches appear in the
 * properties panel — light row, then dark row.
 */
export const STICKY_NOTE_COLORS: readonly {
  name: StickyNoteHueName;
  variant: "light" | "dark";
  value: string;
}[] = [
  ...STICKY_NOTE_HUE_NAMES.map((name) => ({
    name,
    variant: "light" as const,
    value: STICKY_NOTE_HUES[name][0],
  })),
  ...STICKY_NOTE_HUE_NAMES.map((name) => ({
    name,
    variant: "dark" as const,
    value: STICKY_NOTE_HUES[name][1],
  })),
];

/**
 * The ink a note's label is drawn in when its fill is the given color.
 *
 * A dark fill needs light ink and a light fill needs dark ink, otherwise
 * the label is unreadable. The user can still override the ink afterwards
 * (the note's stroke color is an independent control) — this only decides
 * what a *fill* pick leaves behind.
 */
export const STICKY_NOTE_INK_FOR_BG = (backgroundColor: string): string => {
  return isDarkFill(backgroundColor) ? "#ffffff" : "#1e1e1e";
};

// a local relative-luminance check rather than `isColorDark` from `./colors`,
// which reads the default fill from this module
const isDarkFill = (color: string): boolean => {
  const hex = color.trim().toLowerCase();
  const match = /^#?([0-9a-f]{6})$/.exec(hex);
  if (!match) {
    // a color we cannot read is treated as light, which keeps the label dark
    // — the safe default
    return false;
  }
  const int = parseInt(match[1], 16);
  // eslint-disable-next-line no-bitwise
  const r = (int >> 16) & 0xff;
  // eslint-disable-next-line no-bitwise
  const g = (int >> 8) & 0xff;
  // eslint-disable-next-line no-bitwise
  const b = int & 0xff;
  // relative luminance (ITU-R BT.709), the usual perceptual weighting
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  // 0.5 is where dark ink on the paper beats light ink — white on the
  // palette's lighter "dark" variants (amber, orange, teal, green) reads
  // worse than black does, so those keep the dark ink
  return luminance < 0.5;
};

/**
 * The three size presets a sticky note offers. `medium` is the size a fresh
 * note gets (`DEFAULT_STICKY_NOTE_SIZE`), so the preset that matches the
 * default is also the one a note of that size reports as selected.
 */
export const STICKY_NOTE_SIZE_PRESETS = {
  small: { width: 150, height: 150 },
  medium: { width: 250, height: 250 },
  large: { width: 400, height: 400 },
} as const;

export type StickyNoteSizePreset = keyof typeof STICKY_NOTE_SIZE_PRESETS;

/** the size presets, in the order the buttons appear */
export const STICKY_NOTE_SIZE_PRESET_NAMES = Object.keys(
  STICKY_NOTE_SIZE_PRESETS,
) as StickyNoteSizePreset[];

/**
 * The font sizes the typography control offers, in the order the buttons
 * appear. They are *ceilings*: the note's auto-fit shrinks the label below
 * the picked size when the text does not fit (see `getStickyNoteLayout`).
 */
export const STICKY_NOTE_FONT_SIZES = [16, 20, 28, 36, 48] as const;

/** the alignment a note's label can take */
export const STICKY_NOTE_TEXT_ALIGNMENTS = ["left", "center", "right"] as const;

export type StickyNoteTextAlignment =
  typeof STICKY_NOTE_TEXT_ALIGNMENTS[number];

/**
 * The style flags a note's label can carry.
 *
 * The two are independent: a label can be bold *and* italic at once, the
 * way a word processor can. The style applies to the whole label —
 * Excalidraw's text model has no rich runs, so a sticky note styles its
 * label the way it styles its fill: per note, not per word.
 */
export const STICKY_NOTE_FONT_STYLE_FLAGS = ["bold", "italic"] as const;

export type StickyNoteFontStyleFlag =
  typeof STICKY_NOTE_FONT_STYLE_FLAGS[number];

/**
 * The maximum number of tags a note carries. A tag row that overflows the
 * note is truncated rather than wrapped, so the note's geometry stays
 * predictable.
 */
export const STICKY_NOTE_MAX_TAGS = 3;

/** the pill a tag is drawn as */
export const STICKY_NOTE_TAG = {
  fontSize: 10,
  fontFamily: "Helvetica, Arial, sans-serif",
  paddingX: 5,
  radius: 4,
  /** how strongly the pill is washed into the paper */
  opacity: 0.16,
} as const;

/**
 * The emoji a note can be stamped with.
 *
 * A short, curated set — the point is a quick reaction, not a full emoji
 * keyboard. The set leans on the reactions a note actually gets in a
 * workshop (agreement, attention, questions, warmth) rather than on
 * decorative ones.
 */
export const STICKY_NOTE_EMOJI = [
  "👍",
  "👎",
  "❤️",
  "🔥",
  "⭐",
  "💡",
  "🎯",
  "✅",
  "❌",
  "❓",
  "❗",
  "⚠️",
  "🚀",
  "👀",
  "🤔",
  "😀",
  "😅",
  "😢",
  "🙏",
  "👏",
  "💬",
  "📌",
  "📝",
  "🕐",
  "🏁",
] as const;
