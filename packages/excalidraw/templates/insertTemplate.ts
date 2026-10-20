/**
 * Putting a template on the board.
 *
 * A template is inserted the way a library item is: its elements are built,
 * dropped in the middle of the viewport, given fresh ids, and selected. The
 * editor's own machinery does the placing, so a template lands on the board
 * exactly where the user's cursor would have put it.
 */

import type { ExcalidrawElement } from "@excalidraw/element/types";

import { buildTemplateElements } from "./builder";

import type { ExcalidrawTemplate } from "./types";

/**
 * The part of the editor the insertion needs. Kept structural so that the
 * templates do not depend on the editor's internals.
 */
export type TemplateHost = {
  addElementsFromPasteOrLibrary(opts: {
    elements: readonly ExcalidrawElement[];
    files: null;
    position: "center";
  }): void;
};

/**
 * Inserts a template into the board the editor is showing.
 *
 * @returns whether the template had anything to insert
 */
export const insertTemplate = (
  host: TemplateHost,
  template: ExcalidrawTemplate,
): boolean => {
  const elements = buildTemplateElements(template);

  if (!elements.length) {
    return false;
  }

  host.addElementsFromPasteOrLibrary({
    elements,
    files: null,
    position: "center",
  });

  return true;
};
