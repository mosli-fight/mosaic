/**
 * The diagram catalogue: the ready-made diagrams the gallery offers after the
 * original templates.
 *
 * The originals stay where they were — they are the gallery's first cards and
 * its default view. These are the examples a person opens when they already
 * know they want a diagram rather than a board: a data model, a flow, an
 * architecture, a sequence.
 *
 * This module is loaded on demand. It is the largest part of the catalogue,
 * and a board that never opens the gallery should not carry it, so the
 * gallery imports it from a chunk of its own.
 */

import type { ExcalidrawTemplate } from "../types";

import { diagramTemplate } from "../diagram";
import { ARCHITECTURE_DIAGRAMS } from "./architecture";
import { DATA_DIAGRAMS } from "./data";
import { FLOW_DIAGRAMS } from "./flow";
import { PROCESS_DIAGRAMS } from "./process";
import { SEQUENCE_DIAGRAMS } from "./sequence";
import { SOFTWARE_DIAGRAMS } from "./software";

/**
 * Every diagram example, in the order the gallery lists them.
 *
 * ORDER matters: the categories are shown in catalogue order, so the data
 * models come first, then the flows, then the architectures and the software
 * diagrams.
 */
export const DIAGRAM_TEMPLATES: readonly ExcalidrawTemplate[] = [
  ...DATA_DIAGRAMS.map(diagramTemplate),
  ...FLOW_DIAGRAMS.map(diagramTemplate),
  ...PROCESS_DIAGRAMS.map(diagramTemplate),
  ...ARCHITECTURE_DIAGRAMS.map(diagramTemplate),
  ...SOFTWARE_DIAGRAMS.map(diagramTemplate),
  ...SEQUENCE_DIAGRAMS,
];
