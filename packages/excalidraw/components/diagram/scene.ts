/**
 * Turning a laid-out diagram into elements, and keeping them in step.
 *
 * Every element this module makes carries a tag in `customData`:
 *
 *     { diagram: true, diagramRole: "node", diagramNode: "api-gateway" }
 *
 * The tag is what makes the sync safe. A re-parse finds the element it made
 * last time by its tag and updates it in place; anything without a tag was
 * drawn by hand and is never touched. It is also what lets a rename on the
 * canvas find the node it belongs to.
 */

import {
  COLOR_PALETTE,
  FONT_FAMILY,
  ROUNDNESS,
  VERTICAL_ALIGN,
  getFontString,
  getLineHeight,
} from "@excalidraw/common";

import {
  computeBoundTextPosition,
  getBoundTextMaxWidth,
  isImageElement,
  measureText,
  newArrowElement,
  newElement,
  newElementWith,
  newFrameElement,
  newImageElement,
  newLinearElement,
  newTextElement,
  wrapText,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import { MIME_TYPES } from "@excalidraw/common";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawLinearElement,
  ExcalidrawTextElement,
  ExcalidrawTextElementWithContainer,
} from "@excalidraw/element/types";

import {
  diagramIconFileId,
  iconToDataURL,
  ICON_FILE_ID_PREFIX,
} from "../icons/iconDrawing";
import { findIconById, findIconByName } from "../icons/icons";

import type { BinaryFileData } from "../../types";

import type {
  DiagramLayout,
  DiagramModel,
  DiagramType,
  LaidOutEdge,
} from "./types";

/** the key every generated element is marked with */
export const DIAGRAM_CUSTOM_DATA_KEY = "diagram";

/** what an element made by the pane is doing in the diagram */
export type DiagramRole =
  | "node"
  | "label"
  | "icon"
  | "edge"
  | "edge-label"
  | "group"
  | "lifeline";

/** the tag carried in `customData` */
export type DiagramTag = {
  diagram: true;
  diagramRole: DiagramRole;
  /** the node's slug, for a node and everything that belongs to it */
  diagramNode?: string;
  /** the edge's id, for an arrow */
  diagramEdge?: string;
  /** the group's id, for a frame */
  diagramGroup?: string;
};

/** the font the diagram is written in */
const DIAGRAM_FONT_FAMILY = FONT_FAMILY.Helvetica;

/** the size a node's label is written in */
const LABEL_FONT_SIZE = 16;

/** the size a table card's body is written in */
const TABLE_FONT_SIZE = 14;

/** the size an icon glyph is drawn at */
const ICON_FONT_SIZE = 18;

/** the size a library icon is drawn at in a node's corner */
const DIAGRAM_ICON_SIZE = 28;

/** how far a library icon sits from the node's corner */
const DIAGRAM_ICON_INSET = 8;

/** the size an edge's label is written in */
const EDGE_LABEL_FONT_SIZE = 12;

/** the ink a shape is drawn in when the code does not pick a color */
const DEFAULT_STROKE = COLOR_PALETTE.black;

/** the paper a shape is painted on when the code does not pick a color */
const DEFAULT_BACKGROUND = COLOR_PALETTE.transparent;

/**
 * The colors the `[color: ...]` attribute understands.
 *
 * A name that is not here is ignored rather than guessed at: an unknown
 * attribute must not break the line, and a wrong color is worse than none.
 */
const NAMED_COLORS: Record<string, { background: string; stroke: string }> = {
  blue: { background: COLOR_PALETTE.blue[1], stroke: COLOR_PALETTE.blue[4] },
  green: { background: COLOR_PALETTE.green[1], stroke: COLOR_PALETTE.green[4] },
  red: { background: COLOR_PALETTE.red[1], stroke: COLOR_PALETTE.red[4] },
  yellow: {
    background: COLOR_PALETTE.yellow[1],
    stroke: COLOR_PALETTE.yellow[4],
  },
  orange: {
    background: COLOR_PALETTE.orange[1],
    stroke: COLOR_PALETTE.orange[4],
  },
  violet: {
    background: COLOR_PALETTE.violet[1],
    stroke: COLOR_PALETTE.violet[4],
  },
  purple: {
    background: COLOR_PALETTE.violet[1],
    stroke: COLOR_PALETTE.violet[4],
  },
  pink: { background: COLOR_PALETTE.pink[1], stroke: COLOR_PALETTE.pink[4] },
  teal: { background: COLOR_PALETTE.teal[1], stroke: COLOR_PALETTE.teal[4] },
  cyan: { background: COLOR_PALETTE.cyan[1], stroke: COLOR_PALETTE.cyan[4] },
  gray: { background: COLOR_PALETTE.gray[1], stroke: COLOR_PALETTE.gray[4] },
  grey: { background: COLOR_PALETTE.gray[1], stroke: COLOR_PALETTE.gray[4] },
  black: { background: COLOR_PALETTE.transparent, stroke: COLOR_PALETTE.black },
};

/**
 * The glyphs the `[icon: ...]` attribute understands.
 *
 * The editor has no icon set of its own, and shipping one for this would be
 * a second visual language on the board. A glyph is honest about what it
 * is, renders everywhere, and stays out of the way of the label.
 */
const ICON_GLYPHS: Record<string, string> = {
  server: "🖥",
  database: "🗄",
  db: "🗄",
  storage: "🗄",
  cloud: "☁",
  user: "👤",
  users: "👥",
  person: "👤",
  lock: "🔒",
  key: "🔑",
  shield: "🛡",
  api: "🔌",
  queue: "📬",
  cache: "⚡",
  file: "📄",
  folder: "📁",
  mail: "✉",
  email: "✉",
  mobile: "📱",
  phone: "📱",
  browser: "🌐",
  globe: "🌐",
  web: "🌐",
  search: "🔍",
  chart: "📊",
  analytics: "📊",
  clock: "🕒",
  timer: "⏱",
  gear: "⚙",
  settings: "⚙",
  service: "⚙",
  worker: "⚙",
  function: "λ",
  lambda: "λ",
  code: "⌨",
  terminal: "⌨",
  gateway: "🚪",
  router: "🧭",
  loadbalancer: "⚖",
  balance: "⚖",
  monitor: "📈",
  log: "📝",
  logs: "📝",
  alert: "🔔",
  notification: "🔔",
  payment: "💳",
  cart: "🛒",
  bot: "🤖",
  ai: "✨",
};

/**
 * The colors a node is drawn in.
 *
 * @param color the `[color: ...]` value, if the line had one
 */
export const resolveNodeColor = (
  color: string | undefined,
): { background: string; stroke: string } => {
  if (!color) {
    return { background: DEFAULT_BACKGROUND, stroke: DEFAULT_STROKE };
  }

  const named = NAMED_COLORS[color.trim().toLowerCase()];

  if (named) {
    return named;
  }

  // a hex color is taken as given: the person wrote exactly what they meant
  if (/^#[0-9a-f]{3,8}$/i.test(color.trim())) {
    return { background: DEFAULT_BACKGROUND, stroke: color.trim() };
  }

  return { background: DEFAULT_BACKGROUND, stroke: DEFAULT_STROKE };
};

/** the glyph for an icon name, or null when it is not one we know */
export const resolveIconGlyph = (icon: string | undefined): string | null => {
  if (!icon) {
    return null;
  }

  return ICON_GLYPHS[icon.trim().toLowerCase()] ?? null;
};

/** the tag for an element */
const tag = (
  role: DiagramRole,
  key: { node?: string; edge?: string; group?: string },
): DiagramTag => ({
  diagram: true,
  diagramRole: role,
  ...(key.node ? { diagramNode: key.node } : {}),
  ...(key.edge ? { diagramEdge: key.edge } : {}),
  ...(key.group ? { diagramGroup: key.group } : {}),
});

/** whether an element was made by the pane */
export const isDiagramElement = (element: ExcalidrawElement): boolean =>
  (element.customData as Record<string, unknown> | undefined)?.[
    DIAGRAM_CUSTOM_DATA_KEY
  ] === true;

/** the tag on an element, or null when it has none */
export const getDiagramTag = (
  element: ExcalidrawElement,
): DiagramTag | null => {
  const customData = element.customData as Record<string, unknown> | undefined;

  if (!customData || customData[DIAGRAM_CUSTOM_DATA_KEY] !== true) {
    return null;
  }

  return customData as unknown as DiagramTag;
};

/**
 * The label of a shape: a text element bound to it, wrapped to its width.
 *
 * The label is bound rather than merely placed on top, so the shape owns it
 * — selecting the shape selects its label, and editing the label on the
 * canvas edits the node.
 */
const createBoundLabel = (
  container: ExcalidrawElement,
  text: string,
  options: {
    fontSize?: number;
    textAlign?: "left" | "center";
    verticalAlign?: "top" | "middle";
    id?: string;
    tag?: DiagramTag;
  } = {},
): ExcalidrawTextElement => {
  const fontSize = options.fontSize ?? LABEL_FONT_SIZE;
  const lineHeight = getLineHeight(DIAGRAM_FONT_FAMILY);

  const label = newTextElement({
    x: container.x,
    y: container.y,
    text,
    originalText: text,
    fontSize,
    fontFamily: DIAGRAM_FONT_FAMILY,
    lineHeight,
    textAlign: options.textAlign ?? "center",
    verticalAlign: options.verticalAlign ?? VERTICAL_ALIGN.MIDDLE,
    autoResize: true,
    containerId: container.id,
    strokeColor: DEFAULT_STROKE,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 1,
    roughness: 0,
    opacity: 100,
    ...(options.id ? { id: options.id } : {}),
    ...(options.tag ? { customData: options.tag } : {}),
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

/** the label text of a node, which for a table card includes its fields */
export const nodeLabelText = (
  label: string,
  fields: readonly string[],
  type: DiagramType,
): string => {
  if (type !== "erd" || !fields.length) {
    return label;
  }

  return [label, "", ...fields].join("\n");
};

/** the shape a node is drawn as */
const resolveShape = (
  node: DiagramModel["nodes"][number],
  type: DiagramType,
): "rectangle" | "ellipse" | "diamond" => {
  if (node.shape) {
    return node.shape;
  }

  if (type === "flowchart") {
    if (/^(start|begin|end|finish|stop)$/i.test(node.label.trim())) {
      return "ellipse";
    }
    if (node.label.trim().endsWith("?")) {
      return "diamond";
    }
  }

  return "rectangle";
};

/** a stable element id for a tag, so a re-parse can find its element */
const elementIdFor = (
  role: DiagramRole,
  key: string,
  reuse: Map<string, string> | undefined,
): string | undefined => {
  if (!reuse) {
    return undefined;
  }

  return reuse.get(`${role}:${key}`);
};

/**
 * The elements of a diagram, ready to be put on a board.
 *
 * @param model the parsed diagram
 * @param layout where its things go
 * @param type the diagram type, which decides how nodes look
 * @param reuse element ids to keep, keyed `role:diagramKey` — this is how a
 *   rename on the canvas keeps the element it renamed instead of replacing it
 */
export const buildDiagramElements = (
  model: DiagramModel,
  layout: DiagramLayout,
  type: DiagramType,
  reuse?: Map<string, string>,
): ExcalidrawElement[] => {
  const elements: ExcalidrawElement[] = [];

  /** the frame element each group became, so children can point at it */
  const frameIds = new Map<string, string>();

  /** the shape element each node became, so arrows can bind to it */
  const shapeIds = new Map<string, string>();

  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  // frames first: a child cannot point at a frame that is not there yet
  for (const group of layout.groups) {
    const frame = newFrameElement({
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      name: group.label,
      ...(elementIdFor("group", group.id, reuse)
        ? { id: elementIdFor("group", group.id, reuse)! }
        : {}),
      customData: tag("group", { group: group.id }),
    });

    frameIds.set(group.id, frame.id);
    elements.push(frame);
  }

  /** the innermost group a node belongs to, whose frame it sits in */
  const frameForNode = (nodeId: string): string | null => {
    const node = nodesById.get(nodeId);

    if (!node?.groupId) {
      return null;
    }

    return frameIds.get(node.groupId) ?? null;
  };

  // nodes
  for (const laidOut of layout.nodes) {
    const node = nodesById.get(laidOut.id);

    if (!node) {
      continue;
    }

    const isParticipant = layout.participants.some(
      (participant) => participant.id === node.id,
    );
    const role: DiagramRole = "node";
    const colors = resolveNodeColor(node.color);
    const shape = isParticipant
      ? ("rectangle" as const)
      : resolveShape(node, type);
    const frameId = frameForNode(node.id);

    const shapeElement = newElement({
      type: shape,
      x: laidOut.x,
      y: laidOut.y,
      width: laidOut.width,
      height: laidOut.height,
      strokeColor: colors.stroke,
      backgroundColor: colors.background,
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      roundness:
        shape === "rectangle" ? { type: ROUNDNESS.ADAPTIVE_RADIUS } : null,
      frameId,
      ...(elementIdFor(role, node.id, reuse)
        ? { id: elementIdFor(role, node.id, reuse)! }
        : {}),
      customData: tag(role, { node: node.id }),
    });

    shapeIds.set(node.id, shapeElement.id);

    const labelText = nodeLabelText(node.label, node.fields, type);
    const label = createBoundLabel(shapeElement, labelText, {
      fontSize: type === "erd" ? TABLE_FONT_SIZE : LABEL_FONT_SIZE,
      textAlign: type === "erd" ? "left" : "center",
      verticalAlign: type === "erd" ? "top" : "middle",
      id: elementIdFor("label", node.id, reuse),
      tag: tag("label", { node: node.id }),
    });

    elements.push(
      newElementWith(shapeElement, {
        boundElements: [{ type: "text", id: label.id }],
      }),
      newElementWith(label, { frameId }),
    );

    // an icon is a small mark in the corner, not part of the label.
    //
    // A name the glyph table knows keeps its glyph: those names are what
    // every diagram written before the icon library used, and a saved board
    // must not change shape under its author. A name the table does not know
    // is looked up in the icon library and drawn as the very same tile the
    // media panel offers, so a diagram and a board speak one visual language.
    const glyph = resolveIconGlyph(node.icon);

    const iconAsset =
      !glyph && type !== "erd" && !isParticipant
        ? findIconByName(node.icon)
        : null;

    if (iconAsset) {
      elements.push(
        newImageElement({
          type: "image",
          x: laidOut.x + DIAGRAM_ICON_INSET,
          y: laidOut.y + DIAGRAM_ICON_INSET,
          width: DIAGRAM_ICON_SIZE,
          height: DIAGRAM_ICON_SIZE,
          fileId: diagramIconFileId(iconAsset),
          status: "saved",
          strokeColor: "transparent",
          backgroundColor: "transparent",
          frameId,
          ...(elementIdFor("icon", node.id, reuse)
            ? { id: elementIdFor("icon", node.id, reuse)! }
            : {}),
          customData: tag("icon", { node: node.id }),
        }),
      );
    }

    if (glyph && type !== "erd" && !isParticipant) {
      const lineHeight = getLineHeight(DIAGRAM_FONT_FAMILY);

      elements.push(
        newTextElement({
          x: laidOut.x + 10,
          y: laidOut.y + 8,
          text: glyph,
          originalText: glyph,
          fontSize: ICON_FONT_SIZE,
          fontFamily: DIAGRAM_FONT_FAMILY,
          lineHeight,
          textAlign: "left",
          verticalAlign: VERTICAL_ALIGN.TOP,
          autoResize: true,
          strokeColor: colors.stroke,
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          roughness: 0,
          opacity: 100,
          frameId,
          ...(elementIdFor("icon", node.id, reuse)
            ? { id: elementIdFor("icon", node.id, reuse)! }
            : {}),
          customData: tag("icon", { node: node.id }),
        }),
      );
    }
  }

  // sequence lifelines, behind the messages
  for (const participant of layout.participants) {
    const lifeline = newLinearElement({
      type: "line",
      x: participant.lifeline.x,
      y: participant.lifeline.y,
      width: 0,
      height: participant.lifeline.height,
      points: [
        pointFrom(0, 0),
        pointFrom(0, participant.lifeline.height),
      ] as ExcalidrawLinearElement["points"],
      strokeColor: COLOR_PALETTE.gray[3],
      backgroundColor: "transparent",
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "dashed",
      roughness: 0,
      opacity: 100,
      ...(elementIdFor("lifeline", participant.id, reuse)
        ? { id: elementIdFor("lifeline", participant.id, reuse)! }
        : {}),
      customData: tag("lifeline", { node: participant.id }),
    });

    elements.push(lifeline);
  }

  // arrows
  for (const edge of layout.edges) {
    const arrow = buildArrow(edge, elementIdFor("edge", edge.id, reuse));

    elements.push(arrow);

    // bind both ends, so moving a shape on the canvas takes its arrows with it
    const fromShape = shapeIds.get(edge.from);
    const toShape = shapeIds.get(edge.to);

    if (fromShape && toShape && edge.from !== edge.to) {
      bindArrow(arrow, fromShape, toShape, edge, elements);
    }

    // an edge label sits on the arrow, bound to it so it moves with the line
    if (edge.label) {
      const label = createBoundLabel(arrow, edge.label, {
        fontSize: EDGE_LABEL_FONT_SIZE,
        textAlign: "center",
        verticalAlign: "middle",
        id: elementIdFor("edge-label", edge.id, reuse),
        tag: tag("edge-label", { edge: edge.id }),
      });

      const bound = newElementWith(arrow, {
        boundElements: [
          ...(arrow.boundElements ?? []),
          { type: "text", id: label.id },
        ],
      });

      Object.assign(arrow, bound);

      elements.push(label);
    }
  }

  return elements;
};

/** the arrow for an edge */
const buildArrow = (
  edge: LaidOutEdge,
  id: string | undefined,
): ExcalidrawLinearElement => {
  const dx = edge.end.x - edge.start.x;
  const dy = edge.end.y - edge.start.y;

  return newArrowElement({
    type: "arrow",
    x: edge.start.x,
    y: edge.start.y,
    width: Math.abs(dx),
    height: Math.abs(dy),
    points: [pointFrom(0, 0), pointFrom(dx, dy)],
    startArrowhead: edge.both ? "arrow" : null,
    endArrowhead: "arrow",
    strokeColor: DEFAULT_STROKE,
    backgroundColor: "transparent",
    fillStyle: "solid",
    strokeWidth: 2,
    strokeStyle: "solid",
    roughness: 0,
    opacity: 100,
    ...(id ? { id } : {}),
    customData: tag("edge", { edge: edge.id }),
  });
};

/**
 * Binds an arrow's ends to the shapes it runs between.
 *
 * The binding is what makes a hand-dragged shape drag its arrows along. It
 * is done after the arrow exists because the shapes' `boundElements` have
 * to list the arrow, and the arrow has to know the shapes.
 */
const bindArrow = (
  arrow: ExcalidrawLinearElement,
  fromShapeId: string,
  toShapeId: string,
  edge: LaidOutEdge,
  elements: ExcalidrawElement[],
) => {
  const forward = edge.end.x >= edge.start.x;

  const startBinding = {
    elementId: fromShapeId,
    fixedPoint: [forward ? 1 : 0, 0.5] as [number, number],
    mode: "orbit" as const,
  };
  const endBinding = {
    elementId: toShapeId,
    fixedPoint: [forward ? 0 : 1, 0.5] as [number, number],
    mode: "orbit" as const,
  };

  const bound = newElementWith(arrow, {
    startBinding,
    endBinding,
  });

  Object.assign(arrow, bound);

  for (const element of elements) {
    if (element.id !== fromShapeId && element.id !== toShapeId) {
      continue;
    }

    const boundElements = element.boundElements ?? [];
    const withoutArrow = boundElements.filter((entry) => entry.id !== arrow.id);

    Object.assign(
      element,
      newElementWith(element, {
        boundElements: [...withoutArrow, { type: "arrow", id: arrow.id }],
      }),
    );
  }
};

/** the elements of a diagram that are already on the board */
export const getDiagramElements = (
  elements: readonly ExcalidrawElement[],
): ExcalidrawElement[] => elements.filter(isDiagramElement);

/**
 * The files the icons of a diagram need.
 *
 * An icon is an image, and an image is nothing without its file. The file
 * id is derived from the icon's id, so two nodes carrying the same icon
 * share one file, and a re-parse asks for nothing new.
 */
export const getDiagramIconFiles = (
  elements: readonly ExcalidrawElement[],
): BinaryFileData[] => {
  const files = new Map<string, BinaryFileData>();

  for (const element of elements) {
    if (getDiagramTag(element)?.diagramRole !== "icon") {
      continue;
    }

    if (!isImageElement(element) || !element.fileId) {
      continue;
    }

    const fileId = element.fileId;

    if (files.has(fileId)) {
      continue;
    }

    const icon = findIconById(fileId.slice(ICON_FILE_ID_PREFIX.length));

    if (!icon) {
      continue;
    }

    files.set(fileId, {
      id: fileId,
      dataURL: iconToDataURL(icon),
      mimeType: MIME_TYPES.svg,
      created: Date.now(),
    });
  }

  return [...files.values()];
};

/**
 * Reconciles a diagram with what is already on the board.
 *
 * Elements made by the pane are replaced by the new layout; everything else
 * — anything the person drew by hand — is passed through untouched. An
 * element whose tag still exists keeps its id, so it is *updated* rather
 * than deleted and recreated: its version moves, its selection survives,
 * and any arrow bound to it stays bound.
 *
 * @returns the complete element list for the scene
 */
export const reconcileDiagram = (
  existing: readonly ExcalidrawElement[],
  model: DiagramModel,
  layout: DiagramLayout,
  type: DiagramType,
  options: {
    /** new diagram key → the key whose element ids should be reused */
    renamedFrom?: ReadonlyMap<string, string>;
  } = {},
): ExcalidrawElement[] => {
  // the ids already on the board, by `role:key`
  const idsByKey = new Map<string, string>();
  const existingByKey = new Map<string, ExcalidrawElement>();

  for (const element of existing) {
    const tagValue = getDiagramTag(element);

    if (!tagValue) {
      continue;
    }

    // an edge's label belongs to its edge, not to a node, so it is keyed by
    // the edge id — otherwise it would be re-created on every pass
    const key =
      tagValue.diagramRole === "edge" || tagValue.diagramRole === "edge-label"
        ? tagValue.diagramEdge
        : tagValue.diagramRole === "group"
        ? tagValue.diagramGroup
        : tagValue.diagramNode;

    if (!key) {
      continue;
    }

    const composite = `${
      tagValue.diagramRole === "label" ? "label" : tagValue.diagramRole
    }:${key}`;

    idsByKey.set(composite, element.id);
    existingByKey.set(composite, element);
  }

  // a rename moves a node's tag but should keep its element
  const reuse = new Map<string, string>();

  for (const [role, key] of idsByKey) {
    reuse.set(role, key);
  }

  if (options.renamedFrom) {
    for (const [nextKey, previousKey] of options.renamedFrom) {
      for (const role of ["node", "label", "icon", "lifeline"] as const) {
        const id = idsByKey.get(`${role}:${previousKey}`);

        if (id) {
          reuse.set(`${role}:${nextKey}`, id);
        }
      }
    }
  }

  const untouched = existing.filter((element) => !isDiagramElement(element));
  const diagramElements = buildDiagramElements(model, layout, type, reuse);

  return [...untouched, ...diagramElements];
};

/**
 * The label a node currently shows on the canvas.
 *
 * The bound text holds the wrapped text in `text` and what the person typed
 * in `originalText`; it is the latter that belongs in the code.
 */
export const getNodeLabelFromCanvas = (
  node: ExcalidrawElement,
  elements: readonly ExcalidrawElement[],
): string | null => {
  const labelId = node.boundElements?.find(
    (entry) => entry.type === "text",
  )?.id;

  if (!labelId) {
    return null;
  }

  const label = elements.find((element) => element.id === labelId);

  if (!label || label.type !== "text") {
    return null;
  }

  return label.originalText;
};

/** the frame element a group became, if it is on the board */
export const findGroupFrame = (
  elements: readonly ExcalidrawElement[],
  groupId: string,
): ExcalidrawFrameElement | null => {
  for (const element of elements) {
    const tagValue = getDiagramTag(element);

    if (
      tagValue?.diagramRole === "group" &&
      tagValue.diagramGroup === groupId
    ) {
      return element as ExcalidrawFrameElement;
    }
  }

  return null;
};
