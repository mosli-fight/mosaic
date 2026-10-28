/**
 * Turns a stored Mosaic scene into a small, model-readable summary.
 *
 * ## Why this is not "return the scene"
 *
 * A board's scene is the editor's full serialised state — every element with
 * its geometry, style, version counters and binding graph, plus `appState` and
 * any embedded files. It is routinely hundreds of kilobytes and can be
 * megabytes. Handing that to a language model burns its context on fields it
 * cannot use (seeds, version nonces, fractional indices) and, past a point,
 * simply fails.
 *
 * What a model actually needs in order to answer "what is on this board?" is:
 *
 * - **what kinds of things are there** — element counts by type,
 * - **what it says** — the text content, which is where the meaning lives,
 * - **how big it is** — a bounding box, so "is this a big diagram?" is
 *   answerable,
 * - **optionally, which elements** — a capped list, for when the counts are not
 *   enough.
 *
 * Everything else is dropped. The caps are not a nicety: without them a single
 * board holding a pasted document would produce a summary as large as the scene
 * it was meant to replace.
 *
 * ## What counts as text
 *
 * Text is not only `type: "text"`. On a Mosaic board it also lives in:
 * code blocks (`code`), frame names and presenter notes, sticky-note authors
 * and tags, and links on any element. Arrow and shape labels are ordinary text
 * elements bound by `containerId`, so they are covered by the plain text case —
 * including the labels the diagram-as-code engine draws for `>`/`<` edges.
 */

import type { ServerOptions } from "./config.js";

/** One piece of text found in the scene, already truncated. */
export type SceneTextItem = {
  /** Where the text came from, so the model can tell a label from a code block. */
  kind:
    | "text"
    | "code"
    | "frame-name"
    | "frame-notes"
    | "link"
    | "sticky-author"
    | "sticky-tag";
  /** Element the text belongs to. Useful for a follow-up `get_board`. */
  elementId: string;
  elementType: string;
  text: string;
  /** True when `text` is a prefix of the stored value. */
  truncated: boolean;
};

/** A single element, when the caller asked for the list. */
export type SceneElementBrief = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** Present only for elements that carry text directly. */
  text?: string;
  /** True when `text` is a prefix. */
  textTruncated?: boolean;
};

export type SceneSummary = {
  /** True when the board has no stored scene, or one with no elements. */
  isEmpty: boolean;
  /**
   * Set when the stored scene could not be parsed.
   *
   * Reported rather than thrown: a corrupt scene is a fact about the board that
   * the caller should see, not a failure of the tool call. The metadata (name,
   * size, timestamps) is still worth returning.
   */
  parseError: string | null;
  /** Size of the stored scene string in bytes, as reported by the database. */
  sceneBytes: number;
  counts: {
    /** Every element in the scene, deleted ones included. */
    total: number;
    /** Elements the editor would draw. */
    visible: number;
    /** Elements marked `isDeleted` — kept by the editor for undo. */
    deleted: number;
    /** Visible elements by `type`, e.g. `{ rectangle: 4, arrow: 3 }`. */
    byType: Record<string, number>;
  };
  /**
   * Bounding box of the visible elements, in scene coordinates.
   *
   * `null` when there is nothing visible. Rotation is ignored: an element's
   * `x`/`y`/`width`/`height` describe its unrotated box, so a rotated element
   * can extend slightly past this rectangle. Good enough for "how big is this",
   * which is the only question it answers.
   */
  bounds: { x: number; y: number; width: number; height: number } | null;
  text: {
    items: SceneTextItem[];
    /** How many text items the scene contains in total. */
    total: number;
    /** How many were left out by the caps. */
    omitted: number;
    /** True when any item was shortened or omitted. */
    truncated: boolean;
  };
  /** Embedded files (images etc.). Only their size is reported, never content. */
  files: { count: number; bytes: number } | null;
  /** The handful of `appState` fields that describe the board as a whole. */
  appState: {
    name?: string;
    viewBackgroundColor?: string;
    gridSize?: number | null;
  } | null;
  /** Present only when the caller asked for the element list. */
  elements?: {
    items: SceneElementBrief[];
    total: number;
    omitted: number;
  };
};

/**
 * The caps applied to a summary.
 *
 * `maxTextChars` is separate from `maxTextLength` on purpose. The per-item cap
 * stops one pasted document from dominating; the total cap stops ten thousand
 * short labels from doing the same. Either alone leaves a hole.
 */
export type SummaryLimits = {
  maxTextLength: number;
  maxTextItems: number;
  maxTextChars: number;
  maxElements: number;
  maxSceneBytes: number;
};

export const DEFAULT_LIMITS: SummaryLimits = {
  maxTextLength: 500,
  maxTextItems: 200,
  maxTextChars: 20_000,
  maxElements: 50,
  maxSceneBytes: 8 * 1024 * 1024,
};

/** Builds the limits from the server's configured options. */
export const limitsFrom = (options: ServerOptions): SummaryLimits => ({
  ...DEFAULT_LIMITS,
  maxTextLength: options.maxTextLength,
  maxElements: options.maxElements,
  maxSceneBytes: options.maxSceneBytes,
});

/** The shape of a stored scene, as far as this module cares. */
type StoredScene = {
  elements?: unknown;
  appState?: unknown;
  files?: unknown;
};

/** An element, read defensively: every field is optional and may be mistyped. */
type AnyElement = Record<string, unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

const nonEmptyString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Shortens a string to `limit` characters, marking that it happened.
 *
 * The ellipsis is appended *within* the limit rather than after it, so a caller
 * that budgets exactly `maxTextLength` characters per item is never surprised by
 * one extra.
 */
const truncate = (
  text: string,
  limit: number,
): { text: string; truncated: boolean } => {
  if (text.length <= limit) {
    return { text, truncated: false };
  }
  // `limit - 1` leaves room for the ellipsis. A limit of 1 would otherwise
  // produce a bare "…" with no content at all.
  const keep = Math.max(0, limit - 1);
  return { text: `${text.slice(0, keep)}…`, truncated: true };
};

/**
 * Collects every piece of text an element carries.
 *
 * Order matters only in that it is stable: text elements first, then the
 * element's own fields. The caller applies the caps afterwards, so this function
 * is deliberately unbounded — it is the thing that knows what "all the text"
 * means, and the caps are a separate concern.
 */
const textOf = (
  element: AnyElement,
): { kind: SceneTextItem["kind"]; text: string }[] => {
  const found: { kind: SceneTextItem["kind"]; text: string }[] = [];
  const type = typeof element.type === "string" ? element.type : "unknown";

  if (type === "text") {
    // `text` is the wrapped form the editor draws; `originalText` is the
    // unwrapped source. They hold the same words, so one is enough.
    const text =
      nonEmptyString(element.text) ?? nonEmptyString(element.originalText);
    if (text) {
      found.push({ kind: "text", text });
    }
  }

  if (type === "codeblock") {
    const code = nonEmptyString(element.code);
    if (code) {
      found.push({ kind: "code", text: code });
    }
  }

  if (type === "frame" || type === "magicframe") {
    const name = nonEmptyString(element.name);
    if (name) {
      found.push({ kind: "frame-name", text: name });
    }
    const notes = nonEmptyString(element.notes);
    if (notes) {
      found.push({ kind: "frame-notes", text: notes });
    }
  }

  if (type === "stickynote") {
    // The note's visible label is a separate bound text element and is already
    // covered above; these are the fields that exist only on the note itself.
    const author = nonEmptyString(element.author);
    if (author) {
      found.push({ kind: "sticky-author", text: author });
    }
    if (Array.isArray(element.tags)) {
      for (const tag of element.tags) {
        if (typeof tag === "string" && tag.length > 0) {
          found.push({ kind: "sticky-tag", text: tag });
        }
      }
    }
  }

  // A hyperlink is content too — a board of links is unreadable without them.
  // Frames have no `link` field, so this only fires where it is meaningful.
  const link = nonEmptyString(element.link);
  if (link) {
    found.push({ kind: "link", text: link });
  }

  return found;
};

/**
 * Applies the per-item, per-count and total-character caps.
 *
 * Implemented as one pass so the three caps cannot disagree about what was
 * included: `omitted` is whatever the loop did not reach, which is the only
 * definition that stays true when all three are in play at once.
 */
const capText = (
  candidates: {
    element: AnyElement;
    kind: SceneTextItem["kind"];
    text: string;
  }[],
  limits: SummaryLimits,
): SceneSummary["text"] => {
  const items: SceneTextItem[] = [];
  let usedChars = 0;
  let truncated = false;

  for (const candidate of candidates) {
    if (items.length >= limits.maxTextItems) {
      truncated = true;
      break;
    }

    const remaining = limits.maxTextChars - usedChars;
    if (remaining <= 0) {
      truncated = true;
      break;
    }

    // The item is capped by whichever runs out first: its own limit or the
    // budget left for the whole summary.
    const perItem = truncate(candidate.text, limits.maxTextLength);
    const withinBudget = truncate(perItem.text, remaining);

    if (withinBudget.truncated || perItem.truncated) {
      truncated = true;
    }

    items.push({
      kind: candidate.kind,
      elementId:
        typeof candidate.element.id === "string" ? candidate.element.id : "",
      elementType:
        typeof candidate.element.type === "string"
          ? candidate.element.type
          : "unknown",
      text: withinBudget.text,
      truncated: withinBudget.truncated || perItem.truncated,
    });
    usedChars += withinBudget.text.length;

    // A budget that ran out mid-item means there is no room for another one,
    // so stop rather than emitting empty strings.
    if (withinBudget.truncated) {
      break;
    }
  }

  return {
    items,
    total: candidates.length,
    omitted: candidates.length - items.length,
    truncated: truncated || items.length < candidates.length,
  };
};

/** Reads the stored scene string into a shape, or explains why it cannot. */
const parseScene = (
  raw: string | null,
  limits: SummaryLimits,
): { scene: StoredScene | null; parseError: string | null } => {
  if (raw === null || raw === "") {
    return { scene: null, parseError: null };
  }

  // Checked before parsing: `JSON.parse` on a multi-megabyte string allocates
  // several times its size, and a board that large is not going to produce a
  // useful summary anyway.
  const bytes = Buffer.byteLength(raw, "utf8");
  if (bytes > limits.maxSceneBytes) {
    return {
      scene: null,
      parseError:
        `scene is ${bytes} bytes, above the ${limits.maxSceneBytes}-byte ` +
        "summarisation limit; raise MOSAIC_MCP_MAX_SCENE_BYTES to summarise it",
    };
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { scene: null, parseError: "scene is not a JSON object" };
    }
    return { scene: parsed as StoredScene, parseError: null };
  } catch (error) {
    // The message can include a fragment of the scene, which may be large. The
    // position is the useful part and is all that is kept.
    const message = error instanceof Error ? error.message : String(error);
    return { scene: null, parseError: `scene is not valid JSON: ${message}` };
  }
};

/** Counts visible elements by type, and totals for the whole scene. */
const countElements = (
  elements: AnyElement[],
): { counts: SceneSummary["counts"]; visible: AnyElement[] } => {
  const byType: Record<string, number> = {};
  const visible: AnyElement[] = [];
  let deleted = 0;

  for (const element of elements) {
    if (element.isDeleted === true) {
      deleted += 1;
      continue;
    }
    visible.push(element);
    const type = typeof element.type === "string" ? element.type : "unknown";
    byType[type] = (byType[type] ?? 0) + 1;
  }

  return {
    counts: {
      total: elements.length,
      visible: visible.length,
      deleted,
      byType,
    },
    visible,
  };
};

/**
 * The bounding box of the visible elements.
 *
 * Elements with a non-finite coordinate are skipped rather than poisoning the
 * result with `NaN` — a single bad element would otherwise make every bound
 * `NaN` and the whole field useless.
 */
const boundsOf = (visible: AnyElement[]): SceneSummary["bounds"] => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let seen = false;

  for (const element of visible) {
    const x = finiteNumber(element.x);
    const y = finiteNumber(element.y);
    const width = finiteNumber(element.width);
    const height = finiteNumber(element.height);
    if (x === null || y === null || width === null || height === null) {
      continue;
    }
    seen = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + width);
    maxY = Math.max(maxY, y + height);
  }

  if (!seen) {
    return null;
  }

  return {
    // Rounded to whole units: sub-pixel precision is noise at this level of
    // summary, and it makes the numbers easier to read in a transcript.
    x: Math.round(minX),
    y: Math.round(minY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
};

/** Reports how many files are embedded and how large they are, never their data. */
const filesOf = (files: unknown): SceneSummary["files"] => {
  if (!isRecord(files)) {
    return null;
  }
  const entries = Object.values(files);
  let bytes = 0;
  for (const entry of entries) {
    if (isRecord(entry)) {
      const dataURL = nonEmptyString(entry.dataURL);
      if (dataURL) {
        bytes += dataURL.length;
      }
    }
  }
  return { count: entries.length, bytes };
};

/** The few `appState` fields that describe the board rather than the viewport. */
const appStateOf = (appState: unknown): SceneSummary["appState"] => {
  if (!isRecord(appState)) {
    return null;
  }
  const result: NonNullable<SceneSummary["appState"]> = {};
  const name = nonEmptyString(appState.name);
  if (name) {
    result.name = name;
  }
  const viewBackgroundColor = nonEmptyString(appState.viewBackgroundColor);
  if (viewBackgroundColor) {
    result.viewBackgroundColor = viewBackgroundColor;
  }
  const gridSize = finiteNumber(appState.gridSize);
  if (gridSize !== null) {
    result.gridSize = gridSize;
  }
  return result;
};

/** Builds the capped element list, when the caller asked for one. */
const elementBriefs = (
  visible: AnyElement[],
  limits: SummaryLimits,
): NonNullable<SceneSummary["elements"]> => {
  const items: SceneElementBrief[] = [];

  for (const element of visible.slice(0, limits.maxElements)) {
    const brief: SceneElementBrief = {
      id: typeof element.id === "string" ? element.id : "",
      type: typeof element.type === "string" ? element.type : "unknown",
      x: finiteNumber(element.x) ?? 0,
      y: finiteNumber(element.y) ?? 0,
      width: finiteNumber(element.width) ?? 0,
      height: finiteNumber(element.height) ?? 0,
    };

    // Only the element's *primary* text: a brief is a pointer to the element,
    // and the full text is already in `text.items`.
    const primary = textOf(element).find(
      (candidate) => candidate.kind === "text" || candidate.kind === "code",
    );
    if (primary) {
      const capped = truncate(primary.text, limits.maxTextLength);
      brief.text = capped.text;
      brief.textTruncated = capped.truncated;
    }

    items.push(brief);
  }

  return {
    items,
    total: visible.length,
    omitted: Math.max(0, visible.length - items.length),
  };
};

/**
 * Summarises a stored scene.
 *
 * `sceneBytes` is passed in rather than measured so the summary reports what the
 * database says the stored value weighs, which is the number the dashboard's
 * "size" sort uses. It falls back to the actual string length when the column is
 * null (boards saved before that column existed).
 */
export const summarizeScene = (
  raw: string | null,
  options: {
    sceneBytes?: number | null;
    includeElements?: boolean;
    limits?: Partial<SummaryLimits>;
  } = {},
): SceneSummary => {
  const limits: SummaryLimits = { ...DEFAULT_LIMITS, ...options.limits };
  const sceneBytes =
    options.sceneBytes ?? (raw === null ? 0 : Buffer.byteLength(raw, "utf8"));

  const { scene, parseError } = parseScene(raw, limits);

  if (scene === null) {
    return {
      isEmpty: true,
      parseError,
      sceneBytes,
      counts: { total: 0, visible: 0, deleted: 0, byType: {} },
      bounds: null,
      text: { items: [], total: 0, omitted: 0, truncated: false },
      files: null,
      appState: null,
      ...(options.includeElements
        ? { elements: { items: [], total: 0, omitted: 0 } }
        : {}),
    };
  }

  // A scene whose `elements` is not an array is treated as empty rather than as
  // an error: the editor itself does the same (`parseStoredScene` in
  // `excalidraw-app/boardMode.ts` opens an empty board), so a board that renders
  // blank in Mosaic must not look broken here.
  const elements = Array.isArray(scene.elements)
    ? scene.elements.filter(isRecord)
    : [];

  const { counts, visible } = countElements(elements);

  const candidates = visible.flatMap((element) =>
    textOf(element).map((found) => ({ element, ...found })),
  );

  return {
    isEmpty: elements.length === 0,
    parseError: null,
    sceneBytes,
    counts,
    bounds: boundsOf(visible),
    text: capText(candidates, limits),
    files: filesOf(scene.files),
    appState: appStateOf(scene.appState),
    ...(options.includeElements
      ? { elements: elementBriefs(visible, limits) }
      : {}),
  };
};
