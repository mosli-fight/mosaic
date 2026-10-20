/**
 * Putting what the model asked for on the board.
 *
 * The elements are built the way the editor builds them - with their ids,
 * their geometry and their bindings - so that a diagram the model drew is a
 * diagram the person can move, edit and delete like any other.
 */

import {
  DEFAULT_FONT_FAMILY,
  ROUNDNESS,
  VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
} from "@excalidraw/common";

import {
  computeBoundTextPosition,
  getBoundTextMaxWidth,
  measureText,
  newArrowElement,
  newElement,
  newElementWith,
  newTextElement,
  wrapText,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";

import type { AIDiagramElementSpec } from "./types";

/** the font the generated diagram is written in */
const DIAGRAM_FONT_FAMILY = DEFAULT_FONT_FAMILY;

/** the size a shape's label is written in */
const LABEL_FONT_SIZE = 16;

/** the size a free-standing text is written in */
const TEXT_FONT_SIZE = 20;

/** the ink a shape is drawn in */
const STROKE_COLOR = "#1e1e1e";

/** the paper a shape is painted on */
const BACKGROUND_COLOR = "transparent";

/**
 * The label of a shape: a text element bound to it, wrapped to its width
 * and centered in it.
 *
 * The label is bound rather than merely placed on top, so the shape owns
 * it: selecting the shape selects its label, and editing the label edits
 * the shape's text.
 */
const createShapeLabel = (
  container: ExcalidrawElement,
  text: string,
): ExcalidrawTextElement => {
  const lineHeight = getLineHeight(DIAGRAM_FONT_FAMILY);

  const label = newTextElement({
    x: container.x,
    y: container.y,
    text,
    originalText: text,
    fontSize: LABEL_FONT_SIZE,
    fontFamily: DIAGRAM_FONT_FAMILY,
    lineHeight,
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    autoResize: true,
    containerId: container.id,
    strokeColor: STROKE_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
  });

  const maxWidth = getBoundTextMaxWidth(container, label);
  const wrapped = wrapText(label.originalText, getFontString(label), maxWidth);
  const metrics = measureText(wrapped, getFontString(label), lineHeight);

  const sized = newElementWith(label, {
    text: wrapped,
    width: metrics.width,
    height: metrics.height,
  }) as ExcalidrawTextElementWithContainer;

  const { x, y } = computeBoundTextPosition(container, sized, new Map());

  return newElementWith(sized, { x, y }) as ExcalidrawTextElement;
};

/**
 * The elements of a diagram, ready to be put on a board.
 */
export const buildAIElements = (
  specs: readonly AIDiagramElementSpec[],
): ExcalidrawElement[] => {
  const elements: ExcalidrawElement[] = [];

  for (const spec of specs) {
    switch (spec.kind) {
      case "rectangle":
      case "ellipse":
      case "diamond": {
        const shape = newElement({
          type: spec.kind,
          x: spec.x,
          y: spec.y,
          width: spec.width ?? 160,
          height: spec.height ?? 80,
          strokeColor: STROKE_COLOR,
          backgroundColor: BACKGROUND_COLOR,
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          roundness:
            spec.kind === "rectangle"
              ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
              : null,
        });

        if (spec.text) {
          const label = createShapeLabel(shape, spec.text);
          elements.push(
            newElementWith(shape, {
              boundElements: [{ type: "text", id: label.id }],
            }),
          );
          elements.push(label);
        } else {
          elements.push(shape);
        }
        break;
      }

      case "text": {
        const lineHeight = getLineHeight(DIAGRAM_FONT_FAMILY);

        elements.push(
          newTextElement({
            x: spec.x,
            y: spec.y,
            text: spec.text,
            originalText: spec.text,
            fontSize: TEXT_FONT_SIZE,
            fontFamily: DIAGRAM_FONT_FAMILY,
            lineHeight,
            textAlign: "left",
            verticalAlign: VERTICAL_ALIGN.TOP,
            autoResize: true,
            strokeColor: STROKE_COLOR,
            backgroundColor: "transparent",
            fillStyle: "solid",
            strokeWidth: 1,
            roughness: 0,
            opacity: 100,
          }),
        );
        break;
      }
      case "arrow": {
        const x2 = spec.x2 ?? spec.x + 120;
        const y2 = spec.y2 ?? spec.y;

        elements.push(
          newArrowElement({
            type: "arrow",
            x: spec.x,
            y: spec.y,
            points: [pointFrom(0, 0), pointFrom(x2 - spec.x, y2 - spec.y)],
            startArrowhead: null,
            endArrowhead: "arrow",
            strokeColor: STROKE_COLOR,
            strokeWidth: 2,
            strokeStyle: "solid",
            fillStyle: "solid",
            roughness: 0,
            opacity: 100,
          }),
        );
        break;
      }
    }
  }

  return elements;
};

/**
 * The part of the editor the insertion needs.
 *
 * Kept structural so that the assistant does not depend on the editor's
 * internals.
 */
export type AIElementHost = {
  addElementsFromPasteOrLibrary(opts: {
    elements: readonly ExcalidrawElement[];
    files: null;
    position: "center";
  }): void;
};

/**
 * Puts a generated diagram on the board, in the middle of what the person
 * is looking at.
 *
 * @returns how many elements were put on the board
 */
export const insertAIElements = (
  host: AIElementHost,
  specs: readonly AIDiagramElementSpec[],
): number => {
  const elements = buildAIElements(specs);

  if (!elements.length) {
    return 0;
  }

  host.addElementsFromPasteOrLibrary({
    elements,
    files: null,
    position: "center",
  });

  return elements.length;
};
