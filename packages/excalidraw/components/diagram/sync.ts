/**
 * Keeping the code and the canvas in step.
 *
 * Two directions, one guard:
 *
 *   code → canvas   parse, lay out, reconcile. Elements made by the pane are
 *                   updated in place; everything else is left alone.
 *   canvas → code   a node label edited on the canvas is written back into
 *                   the line it came from.
 *
 * The guard is what keeps those two from chasing each other: applying a
 * scene from code marks the pass as code-driven, and the canvas listener
 * ignores the change that pass caused. Without it, writing the code would
 * produce a scene, which would look like a canvas edit, which would write
 * the code again, forever.
 *
 * Nothing here touches React or the editor's internals — the host is passed
 * in — so the whole loop is testable with plain elements.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { parseDiagram, renameNodeInCode, slugify } from "./parser";

import { layoutDiagram } from "./layout";

import {
  getDiagramTag,
  getNodeLabelFromCanvas,
  isDiagramElement,
  reconcileDiagram,
} from "./scene";

import type { DiagramParseError, DiagramType } from "./types";

/** where the diagram is put on the board */
export const DIAGRAM_ORIGIN = { x: 0, y: 0 };

export type DiagramSyncResult = {
  /** the scene the code describes, with everything else passed through */
  elements: ExcalidrawElement[];
  errors: DiagramParseError[];
  /** whether the code produced anything to draw */
  hasDiagram: boolean;
};

/**
 * Turns code into the scene it describes.
 *
 * A parse error never empties the board: the caller is expected to keep the
 * last good scene, and this function says so by returning `errors` and the
 * elements unchanged.
 *
 * @param existing the scene as it is now
 * @param code the code as it is now
 * @param type the diagram type
 * @param options.renamedFrom node ids that changed label since the last pass
 */
export const syncCodeToScene = (
  existing: readonly ExcalidrawElement[],
  code: string,
  type: DiagramType,
  options: { renamedFrom?: ReadonlyMap<string, string> } = {},
): DiagramSyncResult => {
  const { model, errors } = parseDiagram(code, type);

  if (errors.length) {
    return { elements: [...existing], errors, hasDiagram: false };
  }

  if (!model.nodes.length) {
    // an empty diagram is not an error: it removes what the pane drew and
    // leaves the rest of the board alone
    return {
      elements: existing.filter((element) => !isDiagramElement(element)),
      errors,
      hasDiagram: false,
    };
  }

  const layout = layoutDiagram(model, type, DIAGRAM_ORIGIN);

  return {
    elements: reconcileDiagram(existing, model, layout, type, {
      renamedFrom: options.renamedFrom,
    }),
    errors,
    hasDiagram: true,
  };
};

/** a rename found on the canvas */
export type CanvasRename = {
  /** the node's id as the code currently has it */
  nodeId: string;
  /** what the person typed on the canvas */
  label: string;
};

/**
 * Finds node labels that were edited on the canvas.
 *
 * Only labels are read: moving or resizing a shape is a layout concern, and
 * the next pass is allowed to overwrite it — that is how the reference
 * behaves, and preserving hand layout would fight the code.
 */
export const findCanvasRenames = (
  elements: readonly ExcalidrawElement[],
  code: string,
  type: DiagramType,
): CanvasRename[] => {
  const { model } = parseDiagram(code, type);
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const renames: CanvasRename[] = [];

  for (const element of elements) {
    const tag = getDiagramTag(element);

    if (tag?.diagramRole !== "node" || !tag.diagramNode) {
      continue;
    }

    const node = nodesById.get(tag.diagramNode);

    if (!node) {
      continue;
    }

    const canvasLabel = getNodeLabelFromCanvas(element, elements);

    if (canvasLabel === null) {
      continue;
    }

    // a table card's label carries its fields below the name; only the name
    // belongs in the code
    const firstLine = canvasLabel.split(/\r?\n/)[0].trim();

    if (!firstLine || firstLine === node.label) {
      continue;
    }

    // the label may have been wrapped for the canvas; compare the unwrapped
    // form so a wrap is not mistaken for a rename
    if (firstLine.replace(/\s+/g, " ") === node.label) {
      continue;
    }

    renames.push({ nodeId: node.id, label: firstLine });
  }

  return renames;
};

/**
 * Writes canvas renames back into the code.
 *
 * @returns the new code and the node ids that changed, or null when nothing
 * did — so the caller can skip a pointless state update
 */
export const applyCanvasRenames = (
  code: string,
  renames: readonly CanvasRename[],
  type: DiagramType,
): { code: string; renamedFrom: Map<string, string> } | null => {
  let nextCode = code;
  const renamedFrom = new Map<string, string>();

  for (const rename of renames) {
    const updated = renameNodeInCode(
      nextCode,
      rename.nodeId,
      rename.label,
      type,
    );

    if (updated === null) {
      continue;
    }

    nextCode = updated;
    renamedFrom.set(slugify(rename.label), rename.nodeId);
  }

  if (!renamedFrom.size) {
    return null;
  }

  return { code: nextCode, renamedFrom };
};

/**
 * The guard around a code-driven scene update.
 *
 * A pass is opened before the scene is replaced and closed after it, so the
 * canvas listener can tell "the person edited this" from "we just wrote
 * it". It counts rather than flags because a re-entrant pass (a rename that
 * triggers a re-render) must not clear the outer one.
 */
export class DiagramSyncGuard {
  private depth = 0;

  /** runs `apply` with the guard open */
  run<T>(apply: () => T): T {
    this.depth++;
    try {
      return apply();
    } finally {
      this.depth--;
    }
  }

  /** whether a code-driven update is in flight */
  get isApplying(): boolean {
    return this.depth > 0;
  }
}

/**
 * The example a board starts with, per diagram type.
 *
 * Opening the pane on an empty board seeds one of these, so the syntax is
 * visible rather than something to be looked up.
 */
export const EXAMPLE_DIAGRAMS: Record<DiagramType, string> = {
  flowchart: [
    "# One node per line; an edge declares its endpoints.",
    "Start",
    "Collect input",
    "Valid?",
    "Save record",
    "Show error",
    "Done",
    "",
    "Start > Collect input",
    "Collect input > Valid?",
    "Valid? > Save record",
    "Valid? > Show error",
    "Save record > Done",
    "Show error > Collect input",
  ].join("\n"),
  architecture: [
    "# Attributes shape a node: [icon: ...] [color: ...] [shape: ...]",
    "Web App [icon: browser] [color: blue]",
    "API Gateway [icon: gateway] [color: violet]",
    "Auth Service [icon: lock] [color: orange]",
    "Postgres [icon: database] [color: green] [shape: ellipse]",
    "Redis [icon: cache] [color: red]",
    "",
    "Web App > API Gateway",
    "API Gateway > Auth Service",
    "API Gateway > Postgres",
    "Auth Service > Postgres",
    "API Gateway > Redis",
  ].join("\n"),
  erd: [
    "# A colon lists the table's fields.",
    "users: id, name, email",
    "orders: id, user_id, total",
    "products: id, name, price",
    "",
    "users > orders",
    "orders > products",
  ].join("\n"),
  sequence: [
    "# Participants across the top; each edge is a message, in order.",
    "Browser",
    "Server",
    "Database",
    "",
    "Browser > Server",
    "Server > Database",
    "Database > Server",
    "Server > Browser",
  ].join("\n"),
};

/** the example for a type */
export const exampleFor = (type: DiagramType): string =>
  EXAMPLE_DIAGRAMS[type] ?? EXAMPLE_DIAGRAMS.flowchart;

/** whether a board has anything the pane drew on it */
export const hasDiagramOnBoard = (
  elements: readonly ExcalidrawElement[],
): boolean => elements.some(isDiagramElement);
