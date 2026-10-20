/**
 * The Miro-style frame vocabulary: the paper formats the frame tool offers
 * and the palette their fills are drawn from.
 *
 * Kept in `@excalidraw/common` because both the element package (which paints
 * a frame) and the editor package (which offers the picker) need to agree on
 * them — the size a preset advertises must be the size the frame is born
 * with, and the swatch a picker shows must be the color the frame gets.
 *
 * NOTE: this module imports nothing, so that it can be imported from
 * `./colors` and `./constants` without a cycle.
 */

/**
 * The id of a frame format.
 *
 * `custom` is the free-form format: the frame is sized by dragging, and it
 * carries no aspect ratio. Every other id names a fixed paper size.
 */
export type FrameFormatId =
  | "custom"
  | "16:9"
  | "4:3"
  | "1:1"
  | "a4"
  | "letter"
  | "mobile"
  | "tablet"
  | "desktop";

export type FrameFormatPreset = {
  id: FrameFormatId;
  /**
   * The size of a frame born with this format, in scene units. `0` for
   * `custom`, which has no fixed size.
   */
  width: number;
  height: number;
};

/**
 * The frame formats, in the order the picker lists them.
 *
 * ORDER matters: it is the order the buttons appear in the format picker.
 *
 * The pixel sizes are the real paper sizes at 96dpi where there is one (A4
 * is 210×297mm, US Letter is 8.5×11in) and a sane screen size otherwise.
 * They are deliberately not scaled to a "nice" round number: a frame is a
 * canvas, and a canvas that is 794×1123 holds what an A4 page holds.
 */
export const FRAME_FORMAT_PRESETS: readonly FrameFormatPreset[] = [
  { id: "custom", width: 0, height: 0 },
  { id: "16:9", width: 1280, height: 720 },
  { id: "4:3", width: 1024, height: 768 },
  { id: "1:1", width: 800, height: 800 },
  { id: "a4", width: 794, height: 1123 },
  { id: "letter", width: 816, height: 1056 },
  { id: "mobile", width: 540, height: 960 },
  { id: "tablet", width: 768, height: 1024 },
  { id: "desktop", width: 1440, height: 900 },
];

/** the format a frame tool starts with — free-form, as it always was */
export const DEFAULT_FRAME_FORMAT: FrameFormatId = "custom";

/**
 * The preset for a format id. Falls back to `custom` for an id we do not
 * know (a file saved by a newer version, say), so a stale id degrades to
 * the free-form frame rather than to nothing.
 */
export const getFrameFormatPreset = (
  id: FrameFormatId | string,
): FrameFormatPreset => {
  return (
    FRAME_FORMAT_PRESETS.find((preset) => preset.id === id) ??
    FRAME_FORMAT_PRESETS[0]
  );
};

/**
 * The size a frame born with the given format has, or `null` for the
 * free-form format, which has none.
 */
export const getFrameFormatSize = (
  id: FrameFormatId | string,
): { width: number; height: number } | null => {
  const preset = getFrameFormatPreset(id);
  return preset.id === "custom" || !preset.width || !preset.height
    ? null
    : { width: preset.width, height: preset.height };
};

/**
 * The aspect ratio (width / height) a frame born with the given format
 * keeps, or `null` for the free-form format.
 */
export const getFrameFormatAspectRatio = (
  id: FrameFormatId | string,
): number | null => {
  const size = getFrameFormatSize(id);
  return size ? size.width / size.height : null;
};

/**
 * The fills a frame can take.
 *
 * A frame is a canvas, not a shape: it is filled with a paper color rather
 * than with one of the element fills, so these are opaque light tints that
 * read as paper behind whatever is drawn on top. `transparent` is the first
 * entry because it is what a fresh frame has — an unpainted canvas.
 */
export const FRAME_FILL_COLORS: readonly string[] = [
  "transparent",
  "#ffffff",
  "#f8f9fa",
  "#e9ecef",
  "#d0ebff",
  "#c5f6fa",
  "#d3f9d8",
  "#fff3bf",
  "#ffe8cc",
  "#ffe3e3",
  "#f3d9fa",
  "#e5dbff",
  "#f8e3e0",
  "#dbe4e8",
];

/**
 * Whether the given color is the "no fill" value — the one the frame
 * tool's fill control resets to.
 */
export const isTransparentFrameFill = (color: string | null | undefined) => {
  return !color || color === "transparent";
};
