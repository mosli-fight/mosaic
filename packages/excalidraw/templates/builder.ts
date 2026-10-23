/**
 * Turns a template's element specs into real elements.
 *
 * The builder is the only place that knows how a template's data becomes a
 * scene: everything else — the gallery, the preview, the insertion — works
 * with the result.
 *
 * Two rules the builder follows:
 *
 * - the elements it makes are *complete*: they carry the ids, the geometry
 *   and the bindings a scene needs, so the template can be inserted without
 *   any further fix-up;
 * - the elements it makes are *deterministic*: the same template always
 *   builds the same elements, so a preview and an insertion agree, and a
 *   template is reproducible from its data alone.
 */

import {
  DEFAULT_FONT_FAMILY,
  ROUNDNESS,
  STICKY_NOTE_HUES,
  STICKY_NOTE_INK_FOR_BG,
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
  newFrameElement,
  newStickyNoteElement,
  newTextElement,
  relayoutStickyNotes,
  wrapText,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";

import { connectorGeometry } from "./connector";

import type {
  ExcalidrawTemplate,
  TemplateConnectorSpec,
  TemplateShapeSpec,
  TemplateStickySpec,
  TemplateTextSpec,
} from "./types";

/** the font the templates are written in */
const TEMPLATE_FONT_FAMILY = DEFAULT_FONT_FAMILY;

/** the size a shape's label is written in */
const DEFAULT_LABEL_FONT_SIZE = 16;

/** the size a free-standing text is written in */
const DEFAULT_TEXT_FONT_SIZE = 20;

/** the ink a shape is drawn in when the template does not say */
const DEFAULT_STROKE_COLOR = "#1e1e1e";

/** the paper a shape is painted on when the template does not say */
const DEFAULT_BACKGROUND_COLOR = "transparent";

/**
 * The line height a font is written at — the same one the editor uses, so a
 * template's text measures exactly as it will once it is on the board.
 */
const getTemplateLineHeight = () => getLineHeight(TEMPLATE_FONT_FAMILY);

/**
 * The label of a shape: a text element bound to the shape, wrapped to the
 * shape's width and centered in it.
 *
 * The label is *bound* rather than merely placed on top, so the shape owns
 * it: selecting the shape selects its label, and editing the label edits
 * the shape's text.
 */
const createShapeLabel = (
  container: ExcalidrawElement,
  spec: TemplateShapeSpec,
): ExcalidrawTextElement => {
  const fontSize = spec.fontSize ?? DEFAULT_LABEL_FONT_SIZE;
  const lineHeight = getTemplateLineHeight();
  const textAlign = spec.textAlign ?? "center";

  const label = newTextElement({
    x: container.x,
    y: container.y,
    text: spec.label ?? "",
    originalText: spec.label ?? "",
    fontSize,
    fontFamily: TEMPLATE_FONT_FAMILY,
    lineHeight,
    textAlign,
    verticalAlign:
      spec.verticalAlign === "top"
        ? VERTICAL_ALIGN.TOP
        : spec.verticalAlign === "bottom"
        ? VERTICAL_ALIGN.BOTTOM
        : VERTICAL_ALIGN.MIDDLE,
    autoResize: true,
    containerId: container.id,
    strokeColor: spec.textColor ?? DEFAULT_STROKE_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
  });

  // the label is wrapped to the shape and measured, so that it sits in the
  // shape the way the editor would place it
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
 * The label of a sticky note: a text element bound to the note, which the
 * note's own layout fits into the note's paper.
 */
const createStickyLabel = (
  note: ExcalidrawElement,
  spec: TemplateStickySpec,
): ExcalidrawTextElement => {
  const fontSize = spec.fontSize ?? DEFAULT_LABEL_FONT_SIZE;
  const lineHeight = getTemplateLineHeight();
  const fill = STICKY_NOTE_HUES[spec.hue ?? "yellow"][0];

  return newTextElement({
    x: note.x,
    y: note.y,
    text: spec.text,
    originalText: spec.text,
    fontSize,
    baseFontSize: fontSize,
    fontFamily: TEMPLATE_FONT_FAMILY,
    lineHeight,
    textAlign: spec.textAlign ?? "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    autoResize: true,
    containerId: note.id,
    strokeColor: STICKY_NOTE_INK_FOR_BG(fill),
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
  });
};

/** a run of text standing on its own */
const createText = (
  spec: TemplateTextSpec,
  frameId: string | undefined,
): ExcalidrawTextElement => {
  const fontSize = spec.fontSize ?? DEFAULT_TEXT_FONT_SIZE;
  const lineHeight = getTemplateLineHeight();
  const textAlign = spec.align ?? "left";

  const text = newTextElement({
    x: spec.x,
    y: spec.y,
    frameId,
    text: spec.text,
    originalText: spec.text,
    fontSize,
    fontFamily: TEMPLATE_FONT_FAMILY,
    lineHeight,
    textAlign,
    verticalAlign: VERTICAL_ALIGN.TOP,
    // the text keeps the width the template gave it, so a heading sits where
    // the template says it does rather than where its glyphs happen to end
    autoResize: false,
    strokeColor: spec.color ?? DEFAULT_STROKE_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
  });

  const wrapped = spec.width
    ? wrapText(text.originalText, getFontString(text), spec.width)
    : text.originalText;
  const metrics = measureText(wrapped, getFontString(text), lineHeight);

  return newElementWith(text, {
    text: wrapped,
    width: spec.width || metrics.width,
    height: metrics.height,
  }) as ExcalidrawTextElement;
};

/** the elements of a template, ready to be put on a board */
export const buildTemplateElements = (
  template: ExcalidrawTemplate,
): ExcalidrawElement[] => {
  const elements: ExcalidrawElement[] = [];
  const stickyNoteIds = new Set<string>();

  // the frames are built first, so that the elements that belong to one can
  // name it as their frame
  const frameIds = new Map<string, string>();

  for (const spec of template.elements) {
    if (spec.kind !== "frame") {
      continue;
    }
    const frame = newFrameElement({
      x: spec.x,
      y: spec.y,
      width: spec.width,
      height: spec.height,
      name: spec.name,
      strokeColor: DEFAULT_STROKE_COLOR,
      backgroundColor: spec.fill ?? "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      roughness: 0,
      opacity: 100,
    });
    frameIds.set(spec.id, frame.id);
    elements.push(frame);
  }

  const frameIdFor = (spec: { inFrame?: string }) =>
    spec.inFrame ? frameIds.get(spec.inFrame) : undefined;

  /**
   * The shapes, by the id of the spec that made them.
   *
   * A connector names the shapes it runs between by their spec ids, so the
   * shapes have to exist before the connectors can be drawn. The connectors
   * are built in a second pass, which also puts them above the shapes in the
   * scene's order — an arrow is drawn over a box, not under it.
   */
  const shapesById = new Map<string, ExcalidrawElement>();

  for (const spec of template.elements) {
    switch (spec.kind) {
      case "frame":
        // built above
        break;
      case "rectangle":
      case "ellipse":
      case "diamond": {
        const shape = newElement({
          type: spec.kind,
          x: spec.x,
          y: spec.y,
          width: spec.width,
          height: spec.height,
          frameId: frameIdFor(spec),
          strokeColor: spec.strokeColor ?? DEFAULT_STROKE_COLOR,
          backgroundColor: spec.backgroundColor ?? DEFAULT_BACKGROUND_COLOR,
          fillStyle: "solid",
          strokeWidth: spec.strokeWidth ?? 1,
          strokeStyle: spec.strokeStyle ?? "solid",
          roughness: 0,
          opacity: 100,
          roundness: spec.roundness
            ? { type: ROUNDNESS.PROPORTIONAL_RADIUS }
            : null,
        });

        if (spec.label) {
          const label = createShapeLabel(shape, spec);
          const bound = newElementWith(shape, {
            boundElements: [{ type: "text", id: label.id }],
          });
          shapesById.set(spec.id, bound);
          elements.push(bound);
          elements.push(label);
        } else {
          shapesById.set(spec.id, shape);
          elements.push(shape);
        }
        break;
      }
      case "sticky": {
        const fill = STICKY_NOTE_HUES[spec.hue ?? "yellow"][0];
        const note = newStickyNoteElement({
          type: "stickynote",
          x: spec.x,
          y: spec.y,
          width: spec.width,
          height: spec.height,
          baseHeight: spec.height,
          tags: spec.tags,
          frameId: frameIdFor(spec),
          strokeColor: STICKY_NOTE_INK_FOR_BG(fill),
          backgroundColor: fill,
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          opacity: 100,
        });
        const label = createStickyLabel(note, spec);
        const bound = newElementWith(note, {
          boundElements: [{ type: "text", id: label.id }],
        });
        stickyNoteIds.add(note.id);
        elements.push(bound);
        elements.push(label);
        break;
      }
      case "text": {
        elements.push(createText(spec, frameIdFor(spec)));
        break;
      }
      case "arrow": {
        const arrow = newArrowElement({
          type: "arrow",
          x: spec.x,
          y: spec.y,
          frameId: frameIdFor(spec),
          points: [pointFrom(0, 0), pointFrom(spec.dx, spec.dy)],
          startArrowhead: null,
          endArrowhead: spec.arrowhead === false ? null : "arrow",
          strokeColor: spec.strokeColor ?? DEFAULT_STROKE_COLOR,
          strokeWidth: spec.strokeWidth ?? 2,
          strokeStyle: spec.strokeStyle ?? "solid",
          fillStyle: "solid",
          roughness: 0,
          opacity: 100,
        });
        elements.push(arrow);
        break;
      }
      case "connector":
        // built below, once every shape exists
        break;
    }
  }

  for (const spec of template.elements) {
    if (spec.kind !== "connector") {
      continue;
    }

    const connector = buildConnector(spec, shapesById, frameIdFor(spec));

    if (!connector) {
      continue;
    }

    elements.push(connector);

    if (spec.label) {
      const label = createArrowLabel(connector, spec.label);
      const bound = newElementWith(connector, {
        boundElements: [{ type: "text", id: label.id }],
      });

      // the arrow is already in the list; replace it with the bound copy so
      // the label is owned by the arrow the scene holds
      elements[elements.indexOf(connector)] = bound;
      elements.push(label);
    }
  }

  // the notes are laid out last: a note's paper is fitted around its label,
  // so the label has to exist before the paper can be sized
  return relayoutStickyNotes(elements, stickyNoteIds) as ExcalidrawElement[];
};

/**
 * The arrow of a connector, bound to the shapes at both ends.
 *
 * The endpoints come from the shapes themselves, so the arrow touches each
 * outline rather than a coordinate someone wrote down. The binding is what
 * keeps it attached when a shape is dragged on the board.
 */
const buildConnector = (
  spec: TemplateConnectorSpec,
  shapesById: Map<string, ExcalidrawElement>,
  frameId: string | undefined,
): ExcalidrawLinearElement | null => {
  const from = shapesById.get(spec.from);
  const to = shapesById.get(spec.to);

  if (!from || !to) {
    return null;
  }

  const geometry = connectorGeometry(
    {
      x: from.x,
      y: from.y,
      width: from.width,
      height: from.height,
      kind: from.type as "rectangle" | "ellipse" | "diamond",
    },
    {
      x: to.x,
      y: to.y,
      width: to.width,
      height: to.height,
      kind: to.type as "rectangle" | "ellipse" | "diamond",
    },
  );

  const arrow = newArrowElement({
    type: "arrow",
    x: geometry.x,
    y: geometry.y,
    frameId,
    points: [pointFrom(0, 0), pointFrom(geometry.dx, geometry.dy)],
    startArrowhead: spec.startArrowhead ? "arrow" : null,
    endArrowhead: spec.arrowhead === false ? null : "arrow",
    strokeColor: spec.strokeColor ?? DEFAULT_STROKE_COLOR,
    strokeWidth: spec.strokeWidth ?? 2,
    strokeStyle: spec.strokeStyle ?? "solid",
    fillStyle: "solid",
    roughness: 0,
    opacity: 100,
  });

  const bound = newElementWith(arrow, {
    startBinding: {
      elementId: from.id,
      fixedPoint: geometry.startFixedPoint as [number, number],
      mode: "orbit",
    },
    endBinding: {
      elementId: to.id,
      fixedPoint: geometry.endFixedPoint as [number, number],
      mode: "orbit",
    },
  });

  // the shapes have to know the arrow too, or dragging one would leave the
  // arrow behind
  for (const shape of [from, to]) {
    const boundElements = shape.boundElements ?? [];
    const withoutArrow = boundElements.filter((entry) => entry.id !== bound.id);

    Object.assign(
      shape,
      newElementWith(shape, {
        boundElements: [...withoutArrow, { type: "arrow", id: bound.id }],
      }),
    );
  }

  return bound;
};

/**
 * The label of an arrow: a text element bound to the line, which the editor
 * places at the middle of the arrow.
 */
const createArrowLabel = (
  arrow: ExcalidrawLinearElement,
  text: string,
): ExcalidrawTextElement => {
  const fontSize = 14;
  const lineHeight = getTemplateLineHeight();

  const label = newTextElement({
    x: arrow.x,
    y: arrow.y,
    text,
    originalText: text,
    fontSize,
    fontFamily: TEMPLATE_FONT_FAMILY,
    lineHeight,
    textAlign: "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    autoResize: true,
    containerId: arrow.id,
    strokeColor: DEFAULT_STROKE_COLOR,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
  });

  const wrapped = wrapText(
    label.originalText,
    getFontString(label),
    Math.max(label.width, 60),
  );
  const metrics = measureText(wrapped, getFontString(label), lineHeight);

  const sized = newElementWith(label, {
    text: wrapped,
    width: metrics.width,
    height: metrics.height,
  }) as ExcalidrawTextElementWithContainer;

  return newElementWith(sized, {
    x: arrow.x + arrow.width / 2 - sized.width / 2,
    y: arrow.y + arrow.height / 2 - sized.height / 2,
  }) as ExcalidrawTextElement;
};

/**
 * The bounds of a template's content, in the template's own coordinates.
 * The preview scales the template by them.
 */
export const getTemplateBounds = (
  template: ExcalidrawTemplate,
): { minX: number; minY: number; width: number; height: number } => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const spec of template.elements) {
    if (spec.kind === "arrow") {
      minX = Math.min(minX, spec.x, spec.x + spec.dx);
      minY = Math.min(minY, spec.y, spec.y + spec.dy);
      maxX = Math.max(maxX, spec.x, spec.x + spec.dx);
      maxY = Math.max(maxY, spec.y, spec.y + spec.dy);
      continue;
    }
    if (spec.kind === "connector") {
      // a connector's arrow is derived from the shapes it joins, and every
      // arrow it draws runs between two of them, so it adds no bounds
      continue;
    }
    minX = Math.min(minX, spec.x);
    minY = Math.min(minY, spec.y);
    maxX = Math.max(maxX, spec.x + spec.width);
    maxY = Math.max(maxY, spec.y + spec.height);
  }

  if (!Number.isFinite(minX)) {
    return { minX: 0, minY: 0, width: 1, height: 1 };
  }

  return {
    minX,
    minY,
    width: Math.max(maxX - minX, 1),
    height: Math.max(maxY - minY, 1),
  };
};
