/**
 * Making sense of what the model answered.
 *
 * A model is asked for a json array and is trusted to mean it, but not to
 * get it exactly right: it may fence the array in markdown, may add a line
 * of prose around it, may call a shape something else, may leave a field
 * out. The parser reads what it can and drops what it cannot, so a slightly
 * wrong answer still puts most of its diagram on the board.
 *
 * When nothing at all can be read, the parser says so, and the panel shows
 * the answer as it was.
 */

import type { AIDiagramElementKind, AIDiagramElementSpec } from "./types";

/** the words a model may use for the kinds of element it can ask for */
const KIND_ALIASES: Record<string, AIDiagramElementKind> = {
  rectangle: "rectangle",
  rect: "rectangle",
  box: "rectangle",
  square: "rectangle",
  ellipse: "ellipse",
  oval: "ellipse",
  circle: "ellipse",
  diamond: "diamond",
  text: "text",
  label: "text",
  arrow: "arrow",
};

/** the size a shape gets when the model does not say */
const DEFAULT_WIDTH = 160;
const DEFAULT_HEIGHT = 80;

/** the length an arrow gets when the model does not say */
const DEFAULT_ARROW_LENGTH = 120;

/** how far off the board an element may be put */
const MAX_COORDINATE = 100000;

/** how big an element may get */
const MAX_SIZE = 10000;

/** a number the model wrote, or nothing */
const toNumber = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/** a number that is safe to build an element from */
const toCoordinate = (value: unknown): number | null => {
  const number = toNumber(value);
  if (number === null) {
    return null;
  }
  return Math.max(-MAX_COORDINATE, Math.min(MAX_COORDINATE, number));
};

/** a positive size, or nothing */
const toSize = (value: unknown): number | null => {
  const number = toNumber(value);
  if (number === null || number <= 0) {
    return null;
  }
  return Math.min(MAX_SIZE, number);
};

/** the label of an element, however the model wrote it */
const toText = (value: unknown): string => {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
};

/**
 * The json array in an answer, if there is one.
 *
 * The array is looked for in the fenced block first, and then in the whole
 * answer, so that a model that wrapped its answer in markdown still counts.
 *
 * @returns the array as text, or `null` when there is no array at all
 */
export const extractJsonArray = (raw: string): string | null => {
  if (!raw) {
    return null;
  }

  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const text = fence ? fence[1] : raw;

  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");

  if (start === -1 || end === -1 || end < start) {
    return null;
  }

  return text.slice(start, end + 1);
};

/**
 * One element the model asked for, or nothing.
 *
 * An element the model did not place is not an element, so an item without
 * a position is dropped rather than guessed at.
 */
const parseItem = (item: unknown): AIDiagramElementSpec | null => {
  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return null;
  }

  const raw = item as Record<string, unknown>;

  const kind =
    KIND_ALIASES[
      String(raw.type ?? raw.kind ?? "")
        .toLowerCase()
        .trim()
    ];
  if (!kind) {
    return null;
  }

  const x = toCoordinate(raw.x);
  const y = toCoordinate(raw.y);
  if (x === null || y === null) {
    return null;
  }

  const text = toText(raw.text ?? raw.label ?? "");

  if (kind === "arrow") {
    // an arrow needs two ends; the model may give them as x2/y2, as
    // toX/toY, or as a delta from the first end
    let x2 = toCoordinate(raw.x2 ?? raw.toX ?? raw.endX);
    let y2 = toCoordinate(raw.y2 ?? raw.toY ?? raw.endY);

    if (x2 === null && y2 === null) {
      const dx = toNumber(raw.dx);
      const dy = toNumber(raw.dy);
      x2 = x + (dx ?? 0);
      y2 = y + (dy ?? 0);
    }

    if (x2 === null) {
      x2 = x + DEFAULT_ARROW_LENGTH;
    }
    if (y2 === null) {
      y2 = y;
    }
    if (x2 === x && y2 === y) {
      x2 = x + DEFAULT_ARROW_LENGTH;
    }

    return { kind, x, y, x2, y2, text };
  }

  const width =
    toSize(raw.width) ?? (kind === "text" ? undefined : DEFAULT_WIDTH);
  const height =
    toSize(raw.height) ?? (kind === "text" ? undefined : DEFAULT_HEIGHT);

  return { kind, x, y, text, width, height };
};

/**
 * The elements an answer asked for.
 *
 * @returns the elements that could be read, or `null` when the answer holds
 * nothing that can be put on a board
 */
export const parseDiagramElements = (
  raw: string,
): AIDiagramElementSpec[] | null => {
  const array = extractJsonArray(raw);
  if (array === null) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(array);
  } catch {
    return null;
  }

  if (!Array.isArray(parsed)) {
    return null;
  }

  const elements: AIDiagramElementSpec[] = [];

  for (const item of parsed) {
    const element = parseItem(item);
    if (element) {
      elements.push(element);
    }
  }

  return elements.length ? elements : null;
};
