/**
 * Turning diagram code into elements for a board.
 *
 * The layout engine already exists — it is what the diagram pane in the app
 * runs — so nothing here re-implements it. This module is the adapter between
 * that engine and a stored scene: it parses, lays out, reconciles and hands
 * back both the elements and the image files their icons need.
 *
 * ## What "insert" means
 *
 * The engine's own rule is that a diagram owns the elements it made and
 * nothing else: `reconcileDiagram` replaces every element carrying a diagram
 * tag and passes everything else through untouched. That is exactly the
 * behaviour a write tool needs — a person's hand-drawn arrows and notes
 * survive an insert — so this module reuses it rather than splicing elements
 * into the array itself.
 *
 * The consequence worth stating plainly: a board holds one diagram. Inserting
 * a second one replaces the first, because the tags that identify a node are
 * its slug and two diagrams would otherwise collide on them. The pane behaves
 * the same way, and the tool is annotated destructive for it.
 */

import { getCommonBounds } from "@excalidraw/element";

import { layoutDiagram } from "@excalidraw/excalidraw/components/diagram/layout";
import { parseDiagram } from "@excalidraw/excalidraw/components/diagram/parser";
import {
  getDiagramIconFiles,
  isDiagramElement,
  reconcileDiagram,
} from "@excalidraw/excalidraw/components/diagram/scene";
import { DIAGRAM_ORIGIN } from "@excalidraw/excalidraw/components/diagram/sync";

import type {
  DiagramModel,
  DiagramType,
} from "@excalidraw/excalidraw/components/diagram/types";
import type { ExcalidrawElement } from "@excalidraw/element/types";

import { ToolError } from "./tools.js";

// Imported for its side effect: `textMetrics.ts` installs the text-measurement
// provider at module load. The engine measures node labels, and the editor's
// default provider needs `document`, which this process does not have.
import "./textMetrics.js";

/** A rendered diagram: what to put on the board, and where it landed. */
export type RenderedDiagram = {
  /** The complete element list for the scene, hand-drawn work included. */
  elements: ExcalidrawElement[];
  /** The image files the icons reference, keyed by file id. */
  files: Record<string, unknown>;
  /** Ids of the elements the diagram itself contributed. */
  elementIds: string[];
  /** The box the diagram occupies, so a caller can place the next thing. */
  bounds: { x: number; y: number; width: number; height: number };
};

/** How far a diagram is placed from content already on the board. */
const INSERT_GAP = 80;

/**
 * Where a new diagram should go when the caller does not say.
 *
 * The pane always draws at the origin, which is fine there because the board
 * is empty. A tool inserting into a board that already has drawings would put
 * the diagram on top of them, so the default is to the right of whatever is
 * already there — visible, and not covering anyone's work. An empty board
 * still gets the origin, which keeps a tool-made diagram identical to one the
 * pane made.
 */
export const defaultDiagramOrigin = (
  existing: readonly ExcalidrawElement[],
): { x: number; y: number } => {
  const drawn = existing.filter(
    (element) => !element.isDeleted && !isDiagramElement(element),
  );

  if (!drawn.length) {
    return { ...DIAGRAM_ORIGIN };
  }

  const [minX, minY, maxX] = getCommonBounds(drawn);

  // `getCommonBounds` returns zeros for an empty list, but a list of elements
  // with no geometry can still produce non-finite values; falling back to the
  // origin is better than writing a NaN coordinate.
  if (![minX, minY, maxX].every(Number.isFinite)) {
    return { ...DIAGRAM_ORIGIN };
  }

  return { x: maxX + INSERT_GAP, y: minY };
};

/**
 * The top-left corner of the diagram already on a board, or null when there
 * is none.
 *
 * `apply_dsl` uses it as the default placement: re-applying edited code should
 * change the diagram, not move it. It is the bounds of the diagram elements
 * rather than their layout origin, because a group's frame starts left of and
 * above the origin — aligning to the origin would shift a grouped diagram by
 * the group's padding on every pass.
 */
export const currentDiagramCorner = (
  elements: readonly ExcalidrawElement[],
): { x: number; y: number } | null => {
  const diagram = elements.filter(
    (element) => !element.isDeleted && isDiagramElement(element),
  );

  if (!diagram.length) {
    return null;
  }

  const [minX, minY] = getCommonBounds(diagram);

  return Number.isFinite(minX) && Number.isFinite(minY)
    ? { x: minX, y: minY }
    : null;
};

/**
 * Parses diagram code, refusing the call rather than inserting what parsed.
 *
 * A half-drawn diagram is worse than none, and the errors carry line numbers
 * a model can act on. The same is true of code that parses to nothing — that
 * is a mistake in the input, not a request to clear the board.
 */
const parseOrRefuse = (code: string, type: DiagramType): DiagramModel => {
  const { model, errors } = parseDiagram(code, type);

  if (errors.length) {
    const detail = errors
      .slice(0, 5)
      .map((error) => `line ${error.line}: ${error.message}`)
      .join("; ");
    const more = errors.length > 5 ? ` (and ${errors.length - 5} more)` : "";

    throw new ToolError(
      `The diagram code could not be parsed — ${detail}${more}. Nothing was ` +
        "written. Fix the code and try again.",
    );
  }

  if (!model.nodes.length) {
    throw new ToolError(
      "The diagram code produced no nodes, so there is nothing to draw. " +
        "Nothing was written. Write at least one node, e.g. " +
        '"api: API server".',
    );
  }

  return model;
};

/** Lays a parsed model out, reconciles it with the board, and gathers files. */
const build = (
  existing: readonly ExcalidrawElement[],
  model: DiagramModel,
  type: DiagramType,
  origin: { x: number; y: number },
): RenderedDiagram => {
  const layout = layoutDiagram(model, type, origin);
  const elements = reconcileDiagram(existing, model, layout, type);

  const files: Record<string, unknown> = {};
  for (const file of getDiagramIconFiles(elements)) {
    files[file.id] = file;
  }

  return {
    elements,
    files,
    elementIds: elements
      .filter((element) => isDiagramElement(element))
      .map((element) => element.id),
    bounds: layout.bounds,
  };
};

/** Renders diagram code into elements for a board. */
export const renderDiagram = (
  existing: readonly ExcalidrawElement[],
  code: string,
  type: DiagramType,
  origin?: { x: number; y: number },
): RenderedDiagram =>
  build(
    existing,
    parseOrRefuse(code, type),
    type,
    origin ?? defaultDiagramOrigin(existing),
  );

/**
 * Renders diagram code so that its content's top-left corner lands on
 * `corner`.
 *
 * The layout is a pure translation of its origin — column widths, gaps and
 * group padding do not depend on where the diagram starts — so laying it out
 * once at the origin and once more at the offset gives the exact placement.
 * That is what makes `apply_dsl` idempotent: the same code applied twice
 * leaves the diagram where it is, rather than nudging it by a group's padding
 * each time.
 */
export const renderDiagramAt = (
  existing: readonly ExcalidrawElement[],
  code: string,
  type: DiagramType,
  corner: { x: number; y: number },
): RenderedDiagram => {
  const model = parseOrRefuse(code, type);
  const probe = layoutDiagram(model, type, DIAGRAM_ORIGIN);

  return build(existing, model, type, {
    x: corner.x - probe.bounds.x,
    y: corner.y - probe.bounds.y,
  });
};
