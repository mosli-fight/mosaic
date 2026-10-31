/**
 * Reading and writing a stored scene, and building elements into it.
 *
 * ## Why a scene is edited as a document, not as a row
 *
 * A board's `scene` column holds the editor's whole serialised state:
 * `elements`, `appState` and `files`. A write tool changes one element, so it
 * has to read the document, change one thing, and put it back. Two rules make
 * that safe:
 *
 * 1. **Everything not being changed is preserved verbatim.** The parsed
 *    document is spread back out on serialisation, so a top-level key this
 *    module has never heard of survives. A tool that rebuilt the document from
 *    the fields it understands would silently drop whatever it did not.
 * 2. **A scene that cannot be parsed is refused, not replaced.** Writing an
 *    empty scene over a corrupt one would turn "this board is broken" into
 *    "this board is empty", which is a worse outcome and irreversible.
 *
 * ## Element construction goes through the editor's own constructors
 *
 * Nothing here hand-writes an element object. `newElement`, `newTextElement`,
 * `newStickyNoteElement`, `newArrowElement` and `newFrameElement` are the same
 * functions the editor's tools call, so a server-made element has the same
 * fields, the same defaults and the same invariants as one drawn by hand —
 * including the ones that are easy to get wrong, such as a sticky note's
 * `baseHeight` or a text element's anchor offset.
 */

import {
  DEFAULT_FONT_SIZE,
  DEFAULT_STICKY_NOTE_SIZE,
  STICKY_NOTE_FALLBACK_FONT_SIZE,
  STICKY_NOTE_MIN_SIZE,
  TEXT_ALIGN,
  VERTICAL_ALIGN,
  getSizeFromPoints,
  randomId,
} from "@excalidraw/common";
import {
  getStickyNoteLayout,
  isInvisiblySmallElement,
  isLinearElement,
  newArrowElement,
  newElement,
  newElementWith,
  newFrameElement,
  newStickyNoteElement,
  newTextElement,
} from "@excalidraw/element";
import { pointFrom } from "@excalidraw/math";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { LocalPoint, Radians } from "@excalidraw/math";

import { ToolError } from "./tools.js";

// Imported for its side effect: `textMetrics.ts` installs the text-measurement
// provider at module load. The editor's default provider needs `document`,
// which this process does not have, so without it the first text element
// throws. See that module's comment.
import "./textMetrics.js";

import type { AddElementSpec, ElementStyleInput } from "./schemas.js";

/** A stored scene, parsed and ready to be changed. */
export type EditableScene = {
  /**
   * The parsed document, exactly as stored.
   *
   * Kept whole so that {@link writeScene} can spread it back out: a key this
   * module does not know about is a key it must not delete.
   */
  document: Record<string, unknown>;
  elements: ExcalidrawElement[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** The scene a board has before anything has been drawn on it. */
export const emptyScene = (): EditableScene => ({
  document: { elements: [], appState: {}, files: {} },
  elements: [],
});

/**
 * Parses a stored scene.
 *
 * A missing scene is an empty board, which is the state a newly created board
 * is in — `create_board` writes no scene at all, so the first `add_element`
 * has to start from nothing rather than fail.
 *
 * A scene that is present but unreadable is a different case entirely and is
 * refused. The message names the board state rather than the JSON parser's
 * complaint: what a caller needs to know is that the board is damaged and this
 * tool will not make it worse.
 */
export const readScene = (raw: string | null): EditableScene => {
  if (raw === null || raw.trim() === "") {
    return emptyScene();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ToolError(
      "This board's stored scene is not valid JSON, so it cannot be edited " +
        "safely. Nothing was written. Open the board in the app to see what " +
        "happened to it.",
    );
  }

  if (!isRecord(parsed)) {
    throw new ToolError(
      "This board's stored scene is not a JSON object, so it cannot be " +
        "edited safely. Nothing was written.",
    );
  }

  if (!Array.isArray(parsed.elements)) {
    throw new ToolError(
      "This board's stored scene has no element list, so it cannot be edited " +
        "safely. Nothing was written.",
    );
  }

  return {
    document: parsed,
    elements: parsed.elements as ExcalidrawElement[],
  };
};

/**
 * Serialises a scene back to the string the column holds.
 *
 * `appState.collaborators` is dropped for the same reason `parseStoredScene` in
 * the app drops it: it is a `Map` at runtime, `JSON.stringify` turns it into
 * `{}`, and a stored `{}` crashes the editor on load when something calls
 * `.forEach` on it. It is live presence, not content, and must never be
 * persisted.
 */
export const writeScene = (scene: EditableScene): string => {
  const appState = isRecord(scene.document.appState)
    ? { ...scene.document.appState }
    : {};

  delete appState.collaborators;

  return JSON.stringify({
    ...scene.document,
    elements: scene.elements,
    appState,
  });
};

/**
 * Merges files into a scene's `files` map.
 *
 * A diagram's icons are images, and an image element is nothing without the
 * file its `fileId` names. The merge is additive: a file this call does not
 * mention stays exactly as stored, because a board's other images belong to
 * elements this tool never touched.
 */
export const addFiles = (
  scene: EditableScene,
  files: Record<string, unknown>,
): void => {
  if (!Object.keys(files).length) {
    return;
  }

  scene.document.files = {
    ...(isRecord(scene.document.files) ? scene.document.files : {}),
    ...files,
  };
};

/** The element with this id, or a refusal naming the id. */
export const findElement = (
  elements: readonly ExcalidrawElement[],
  elementId: string,
): ExcalidrawElement => {
  const element = elements.find((candidate) => candidate.id === elementId);

  if (!element) {
    throw new ToolError(
      `No element with id ${elementId} is on this board. Nothing was written. ` +
        "Use get_board with includeElements to list the element ids.",
    );
  }

  if (element.isDeleted) {
    throw new ToolError(
      `Element ${elementId} has been deleted. Nothing was written.`,
    );
  }

  return element;
};

/** The style fields every element kind accepts, already validated. */
type StyleSpec = Pick<
  ElementStyleInput,
  | "strokeColor"
  | "backgroundColor"
  | "fillStyle"
  | "strokeWidth"
  | "strokeStyle"
  | "roughness"
  | "opacity"
  | "angle"
  | "locked"
  | "link"
>;

/**
 * Removes the keys that were not supplied.
 *
 * `newElement` treats `undefined` differently from "absent" in a few places
 * (`link`, `locked`), so passing an object with explicit `undefined` values
 * would overwrite a default with nothing. Building the object from only the
 * keys that are present keeps "not asked for" meaning "leave the default".
 */
const compact = <T extends Record<string, unknown>>(value: T): Partial<T> => {
  const result: Partial<T> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) {
      (result as Record<string, unknown>)[key] = entry;
    }
  }
  return result;
};

/**
 * The names of the style fields, so {@link styleOf} can pick them out.
 *
 * Listed rather than derived from the type, because the type is erased: at
 * runtime `styleOf` is handed the *whole* element spec, and a spread of it
 * would carry `width`, `height` and `points` into the constructor too — where
 * they would land after the constructor's own geometry and overwrite it. That
 * is how an arrow whose size is computed from its points ends up 0×0.
 */
const STYLE_KEYS: readonly (keyof StyleSpec)[] = [
  "strokeColor",
  "backgroundColor",
  "fillStyle",
  "strokeWidth",
  "strokeStyle",
  "roughness",
  "opacity",
  "angle",
  "locked",
  "link",
];

/**
 * The style fields, ready to hand to a constructor.
 *
 * `angle` is the one field that needs translating: the schema accepts a plain
 * number of radians, while the element model brands it `Radians` so that a
 * degrees value cannot be passed where radians are meant. The cast is the
 * boundary between the two — the number is already radians by contract, and
 * this is the one place that says so.
 */
const styleOf = (input: StyleSpec) => {
  const picked: Record<string, unknown> = {};
  for (const key of STYLE_KEYS) {
    if (input[key] !== undefined) {
      picked[key] = input[key];
    }
  }

  const { angle, ...rest } = picked;
  return {
    ...compact(rest),
    ...(angle !== undefined ? { angle: angle as Radians } : {}),
  };
};

/**
 * Gives every element in a freshly built group an id no board element has.
 *
 * `randomId()` collisions are vanishingly unlikely, but an id that already
 * exists makes the scene ambiguous — two elements, one identity — and the
 * editor keys everything by id. The rewrite is applied to the whole group at
 * once so the references *within* it stay correct: a sticky note's label points
 * at the note through `containerId`, the note points back through
 * `boundElements`, a template's connectors name the shapes they join through
 * `startBinding`/`endBinding`, and its elements name their frame through
 * `frameId`. Renumbering one without the others would orphan them.
 *
 * The check is "does any id collide", not "renumber everything": a group that
 * is already unique is returned untouched, so a caller's ids survive when they
 * can.
 */
export const ensureFreshIds = (
  elements: ExcalidrawElement[],
  existingIds: ReadonlySet<string>,
): ExcalidrawElement[] => {
  if (!elements.some((element) => existingIds.has(element.id))) {
    return elements;
  }

  const remap = new Map<string, string>();
  for (const element of elements) {
    remap.set(element.id, randomId());
  }

  const id = (value: string) => remap.get(value) ?? value;

  return elements.map((element) => {
    const containerId =
      "containerId" in element && typeof element.containerId === "string"
        ? id(element.containerId)
        : undefined;
    const frameId =
      typeof element.frameId === "string"
        ? id(element.frameId)
        : element.frameId;

    // `startBinding`/`endBinding` exist only on linear elements (arrows and
    // lines); on every other element the base type has no such fields. The
    // editor's own `isLinearElement` guard is what narrows them, rather than
    // reaching for the properties on the union and hoping they are there.
    const bindings = isLinearElement(element)
      ? {
          ...(element.startBinding
            ? {
                startBinding: {
                  ...element.startBinding,
                  elementId: id(element.startBinding.elementId),
                },
              }
            : {}),
          ...(element.endBinding
            ? {
                endBinding: {
                  ...element.endBinding,
                  elementId: id(element.endBinding.elementId),
                },
              }
            : {}),
        }
      : {};

    return {
      ...element,
      id: id(element.id),
      frameId,
      ...(containerId !== undefined ? { containerId } : {}),
      boundElements:
        element.boundElements?.map((bound) => ({
          ...bound,
          id: id(bound.id),
        })) ?? element.boundElements,
      ...bindings,
    };
  });
};
/**
 * Builds the elements for one `add_element` call.
 *
 * Returns a list rather than one element because a sticky note with text is
 * two: the note and the label bound to it. The editor models them that way —
 * the label is a real text element with a `containerId` — and a note with a
 * label stored any other way would not render.
 *
 * @param input the validated element spec
 * @param existingIds ids already on the board, so a generated id cannot collide
 */
export const buildElements = (
  input: AddElementSpec,
  existingIds: ReadonlySet<string>,
): ExcalidrawElement[] => {
  const elements = ensureFreshIds(buildElementsUnchecked(input), existingIds);

  // A zero-sized element is deleted the moment the board is opened: the app
  // restores a stored scene with `deleteInvisibleElements: true`, which marks
  // anything `isInvisiblySmallElement` reports as deleted. Writing one would
  // mean reporting success for an element that is not there the next time
  // anyone looks, so it is refused here instead.
  const invisible = elements.find((element) =>
    isInvisiblySmallElement(element),
  );
  if (invisible) {
    throw new ToolError(
      `The ${input.type} would have no size, so the editor would discard it ` +
        "when the board is opened. Nothing was written. Give it a width and " +
        "height, or points that are not all in the same place.",
    );
  }

  return elements;
};

/** The constructors, before id collisions are considered. */
const buildElementsUnchecked = (input: AddElementSpec): ExcalidrawElement[] => {
  const style = styleOf(input);

  switch (input.type) {
    case "rectangle":
    case "ellipse":
      return [
        newElement({
          type: input.type,
          x: input.x,
          y: input.y,
          width: input.width,
          height: input.height,
          ...style,
        }),
      ];

    case "frame":
      return [
        newFrameElement({
          x: input.x,
          y: input.y,
          width: input.width,
          height: input.height,
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...style,
        }),
      ];

    case "text":
      return [
        newTextElement({
          x: input.x,
          y: input.y,
          text: input.text,
          originalText: input.text,
          fontSize: input.fontSize ?? DEFAULT_FONT_SIZE,
          ...(input.fontFamily !== undefined
            ? { fontFamily: input.fontFamily }
            : {}),
          textAlign: input.textAlign ?? TEXT_ALIGN.LEFT,
          verticalAlign: input.verticalAlign ?? VERTICAL_ALIGN.TOP,
          autoResize: true,
          ...style,
        }),
      ];

    case "arrow": {
      // Points are local to the element's origin, which is what the editor
      // stores; the size is derived from them so the element's box matches the
      // line it draws.
      const points: LocalPoint[] = input.points?.length
        ? input.points.map(([x, y]) => pointFrom<LocalPoint>(x, y))
        : [
            pointFrom<LocalPoint>(0, 0),
            pointFrom<LocalPoint>(input.width, input.height),
          ];
      const size = getSizeFromPoints(points);

      return [
        newArrowElement({
          type: "arrow",
          x: input.x,
          y: input.y,
          width: size.width,
          height: size.height,
          points,
          elbowed: false,
          startArrowhead: input.startArrowhead ?? null,
          endArrowhead: input.endArrowhead ?? "arrow",
          ...style,
        }),
      ];
    }

    case "stickynote":
      return buildStickyNote({
        x: input.x,
        y: input.y,
        width: input.width ?? DEFAULT_STICKY_NOTE_SIZE,
        height: input.height ?? input.width ?? DEFAULT_STICKY_NOTE_SIZE,
        text: input.text,
        author: input.author,
        tags: input.tags,
        style,
      });
  }
};

/**
 * A sticky note and, when it has a body, the label bound to it.
 *
 * The label is created first and the note then fitted around it with
 * `getStickyNoteLayout` — the same function the editor calls while a note is
 * being typed into. Doing it in that order is what makes a long body grow the
 * note instead of overflowing it.
 */
const buildStickyNote = (input: {
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  author?: string;
  tags?: string[];
  style: Record<string, unknown>;
}): ExcalidrawElement[] => {
  const width = Math.max(input.width, STICKY_NOTE_MIN_SIZE);
  const height = Math.max(input.height, STICKY_NOTE_MIN_SIZE);

  const note = newStickyNoteElement({
    type: "stickynote",
    x: input.x,
    y: input.y,
    width,
    height,
    baseHeight: height,
    ...(input.author !== undefined ? { author: input.author } : {}),
    ...(input.tags !== undefined ? { tags: input.tags } : {}),
    ...input.style,
  });

  if (!input.text || input.text.trim() === "") {
    return [note];
  }

  const label = newTextElement({
    x: note.x + note.width / 2,
    y: note.y + note.height / 2,
    text: input.text,
    originalText: input.text,
    fontSize: STICKY_NOTE_FALLBACK_FONT_SIZE,
    baseFontSize: STICKY_NOTE_FALLBACK_FONT_SIZE,
    textAlign: TEXT_ALIGN.CENTER,
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    containerId: note.id,
    autoResize: true,
    strokeColor: note.strokeColor,
  });

  const bound = newElementWith(note, {
    boundElements: [{ type: "text", id: label.id }],
  });

  const layout = getStickyNoteLayout(bound, label);

  return [
    newElementWith(bound, layout.container),
    layout.text ? newElementWith(label, layout.text) : label,
  ];
};
