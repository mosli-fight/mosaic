/**
 * Putting one of the repo's built-in templates on a board.
 *
 * ## Why the catalogues are loaded inside the call
 *
 * The gallery's catalogue is the largest data in the editor: 32 board
 * templates and 61 diagram examples, each a list of element specs. It is
 * already kept in its own chunk for the app (`templates/catalogue.ts` and
 * `templates/diagrams/index.ts` say so), and the server has the same reason to
 * keep it out of its startup path — most sessions never insert a template.
 *
 * So this module imports them with `await import(...)` inside the function.
 * esbuild only splits dynamic imports, so the laziness has to be here in the
 * source; `build.mjs` then emits them as chunks that are read from disk the
 * first time `insert_template` is called. The English locale is loaded the
 * same way, for the same reason: it is what turns a template's `nameKey` into
 * the name a person would use.
 *
 * ## Why the lookup accepts a name as well as an id
 *
 * A model that has seen the gallery knows "Kanban Board"; one that has read
 * this tool's description knows `kanban-board`. Both are accepted, and the
 * name match is case- and accent-insensitive, because a name typed from memory
 * is the likeliest input and a case difference is not a mistake worth
 * refusing.
 */

import { getCommonBounds } from "@excalidraw/element";

import { deburr } from "@excalidraw/excalidraw/deburr";

import type { ExcalidrawElement } from "@excalidraw/element/types";
import type { ExcalidrawTemplate } from "@excalidraw/excalidraw/templates/types";

import { ToolError } from "./tools.js";

/** How far a template is placed from content already on the board. */
const INSERT_GAP = 80;

/** How many suggestions an unknown template's error carries. */
const MAX_SUGGESTIONS = 12;

/** A template with the name a person would call it. */
export type TemplateEntry = {
  id: string;
  name: string;
  category: string;
  /** `board` for a gallery template, `diagram` for a diagram example. */
  kind: "board" | "diagram";
};

/** What `insert_template` needs from the catalogues. */
type Catalogues = {
  templates: readonly ExcalidrawTemplate[];
  diagrams: readonly ExcalidrawTemplate[];
  /** Resolves a `nameKey` to its English name. */
  nameOf: (template: ExcalidrawTemplate) => string;
  build: (template: ExcalidrawTemplate) => ExcalidrawElement[];
  boundsOf: (template: ExcalidrawTemplate) => {
    minX: number;
    minY: number;
    width: number;
    height: number;
  };
};

/**
 * The name a `nameKey` points at, from the English locale.
 *
 * The keys are dotted paths into the locale document
 * (`labels.templates.items.kanbanBoard.name`). A key that does not resolve
 * falls back to the template's id, which is still something a caller can use —
 * better than an empty name in a listing.
 */
const nameResolver = (locale: unknown) => {
  return (template: ExcalidrawTemplate): string => {
    let node: unknown = locale;

    for (const part of template.nameKey.split(".")) {
      if (typeof node !== "object" || node === null) {
        return template.id;
      }

      node = (node as Record<string, unknown>)[part];
    }

    return typeof node === "string" && node.trim() ? node : template.id;
  };
};

let cached: Catalogues | null = null;

/**
 * Loads the catalogues, once.
 *
 * Cached for the life of the process: the data is immutable, and a client
 * that inserts three templates should pay for the chunk once. A failed load is
 * not cached — a transient read error would otherwise poison every later call.
 */
const loadCatalogues = async (): Promise<Catalogues> => {
  if (cached) {
    return cached;
  }

  const [catalogue, diagrams, builder, locale] = await Promise.all([
    import("@excalidraw/excalidraw/templates/catalogue"),
    import("@excalidraw/excalidraw/templates/diagrams"),
    import("@excalidraw/excalidraw/templates/builder"),
    import("@excalidraw/excalidraw/locales/en.json"),
  ]);

  const nameOf = nameResolver(
    (locale as { default?: unknown }).default ?? locale,
  );

  cached = {
    templates: catalogue.TEMPLATES,
    diagrams: diagrams.DIAGRAM_TEMPLATES,
    nameOf,
    build: builder.buildTemplateElements,
    boundsOf: builder.getTemplateBounds,
  };

  return cached;
};

/** Every template, boards first, in the order the gallery lists them. */
const allTemplates = (catalogues: Catalogues): TemplateEntry[] => [
  ...catalogues.templates.map((template) => ({
    id: template.id,
    name: catalogues.nameOf(template),
    category: template.category,
    kind: "board" as const,
  })),
  ...catalogues.diagrams.map((template) => ({
    id: template.id,
    name: catalogues.nameOf(template),
    category: template.category,
    kind: "diagram" as const,
  })),
];

/** Case- and accent-folded, for comparing a typed name with a real one. */
const fold = (value: string): string => deburr(value.trim().toLowerCase());

/**
 * The template a reference names, or null.
 *
 * The id is tried first and exactly: it is the unambiguous form, and an id
 * that happens to look like another template's name should still mean the id.
 * The name is then tried folded, so "kanban board" and "Kanban Board" are the
 * same request.
 */
const findTemplate = (
  catalogues: Catalogues,
  reference: string,
): ExcalidrawTemplate | null => {
  const all = [...catalogues.templates, ...catalogues.diagrams];
  const byId = all.find((template) => template.id === reference.trim());

  if (byId) {
    return byId;
  }

  const needle = fold(reference);

  if (!needle) {
    return null;
  }

  return (
    all.find((template) => fold(catalogues.nameOf(template)) === needle) ?? null
  );
};

/** The refusal for a reference that names nothing, with the nearest names. */
const unknownTemplate = (
  catalogues: Catalogues,
  reference: string,
): ToolError => {
  const needle = fold(reference);
  const all = allTemplates(catalogues);

  // Substring hits first — a caller who typed part of a name gets the whole
  // list of things it could be — then the first few, so the message always
  // shows the shape of a real id.
  const matching = all.filter(
    (entry) => needle && fold(entry.name).includes(needle),
  );
  const suggestions = (matching.length ? matching : all)
    .slice(0, MAX_SUGGESTIONS)
    .map((entry) => `${entry.id} ("${entry.name}")`);

  return new ToolError(
    `No template with id or name "${reference}" is built in. Nothing was ` +
      `written. ${all.length} templates are available; ${
        matching.length ? "the closest are" : "for example"
      }: ${suggestions.join(", ")}.`,
  );
};

/** Moves a template's elements so its content starts at `corner`. */
const placeAt = (
  elements: ExcalidrawElement[],
  bounds: { minX: number; minY: number },
  corner: { x: number; y: number },
): ExcalidrawElement[] => {
  const dx = corner.x - bounds.minX;
  const dy = corner.y - bounds.minY;

  if (dx === 0 && dy === 0) {
    return elements;
  }

  return elements.map((element) => ({
    ...element,
    x: element.x + dx,
    y: element.y + dy,
  }));
};

/**
 * Where a template should go when the caller does not say.
 *
 * The same rule `insert_diagram` uses: to the right of whatever is already on
 * the board, so the template is visible and covers nobody's work. An empty
 * board gets the origin.
 */
export const defaultTemplateCorner = (
  existing: readonly ExcalidrawElement[],
): { x: number; y: number } => {
  const drawn = existing.filter((element) => !element.isDeleted);

  if (!drawn.length) {
    return { x: 0, y: 0 };
  }

  const [minX, minY, maxX] = getCommonBounds(drawn);

  if (![minX, minY, maxX].every(Number.isFinite)) {
    return { x: 0, y: 0 };
  }

  return { x: maxX + INSERT_GAP, y: minY };
};

/** A template, built but not yet placed. */
export type BuiltTemplate = {
  elements: ExcalidrawElement[];
  entry: TemplateEntry;
  /** The template's own bounds, in the coordinates its elements are in. */
  bounds: { minX: number; minY: number; width: number; height: number };
};

/**
 * Builds a template's elements.
 *
 * The elements come from the repo's own builder, so a template inserted here
 * is the same set of elements the gallery inserts — same labels, same
 * bindings, same sticky-note fitting. They are still in the template's own
 * coordinates, which start wherever its author drew them; {@link placeTemplate}
 * moves them onto the board.
 *
 * Loading is async and placement is not, because the catalogue is a chunk read
 * from disk while the placement is arithmetic over an already-loaded scene.
 * Splitting them lets a caller await the load *before* it opens the scene it
 * is about to write, which is what keeps the write path synchronous.
 */
export const buildTemplate = async (
  reference: string,
): Promise<BuiltTemplate> => {
  const catalogues = await loadCatalogues();
  const template = findTemplate(catalogues, reference);

  if (!template) {
    throw unknownTemplate(catalogues, reference);
  }

  const elements = catalogues.build(template);

  if (!elements.length) {
    throw new ToolError(
      `The template "${template.id}" has no elements, so there is nothing ` +
        "to insert. Nothing was written.",
    );
  }

  return {
    elements,
    entry: {
      id: template.id,
      name: catalogues.nameOf(template),
      category: template.category,
      kind: catalogues.templates.includes(template) ? "board" : "diagram",
    },
    bounds: catalogues.boundsOf(template),
  };
};

/** A template, built and placed, ready to be added to a scene. */
export type PlacedTemplate = {
  elements: ExcalidrawElement[];
  entry: TemplateEntry;
  bounds: { x: number; y: number; width: number; height: number };
};

/**
 * Places a built template on a board.
 *
 * @param existing the board's elements, so the default corner can avoid them
 * @param corner where the template's content should start; defaults to the
 *   right of whatever is already on the board
 */
export const placeTemplate = (
  built: BuiltTemplate,
  existing: readonly ExcalidrawElement[],
  corner?: { x: number; y: number },
): PlacedTemplate => {
  const target = corner ?? defaultTemplateCorner(existing);

  return {
    elements: placeAt(built.elements, built.bounds, target),
    entry: built.entry,
    bounds: {
      x: target.x,
      y: target.y,
      width: built.bounds.width,
      height: built.bounds.height,
    },
  };
};

/**
 * The templates this server can insert.
 *
 * Loaded on demand, so listing them costs the same chunk the insert does. It
 * exists so a caller can find an id without guessing: the error message for an
 * unknown template names a few, and this names all of them.
 */
export const listTemplates = async (): Promise<TemplateEntry[]> => {
  const catalogues = await loadCatalogues();
  return allTemplates(catalogues);
};
