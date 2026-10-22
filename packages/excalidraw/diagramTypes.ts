/**
 * The diagram types the pane offers.
 *
 * This lives on its own, apart from the pane's parser and layout, because
 * the restore path needs to validate a stored type — and the restore path
 * is on the critical first paint, so it must not pull the whole diagram
 * engine in with it.
 */

import type { DiagramType } from "./types";

/** every diagram type, in the order the selector shows them */
export const DIAGRAM_TYPES: readonly DiagramType[] = [
  "flowchart",
  "architecture",
  "erd",
  "sequence",
] as const;

/** the type a board starts with */
export const DEFAULT_DIAGRAM_TYPE: DiagramType = "flowchart";

/** whether a value is one of the diagram types */
export const isDiagramType = (value: unknown): value is DiagramType =>
  typeof value === "string" &&
  (DIAGRAM_TYPES as readonly string[]).includes(value);
