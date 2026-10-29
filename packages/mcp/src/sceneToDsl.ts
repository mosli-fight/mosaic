/**
 * Reading a board's diagram back into the pane's language.
 *
 * ## Why this is derived from the elements, not from stored code
 *
 * The app keeps the code it last drew in `appState.diagramCode`, but that is
 * not a reliable source for a server: a diagram inserted by `insert_diagram`
 * never had code stored, and a board edited on the canvas can have code that
 * is one debounce behind. The elements are the board. So this module reads
 * them — the tags `buildDiagramElements` put on them, the labels bound to
 * them, the arrowheads — and writes the code that would produce them.
 *
 * ## What "reported rather than dropped" means
 *
 * A board is not only its diagram. Hand-drawn rectangles, sticky notes and
 * free text have no DSL equivalent, and neither does a diagram element whose
 * label happens to contain the language's own punctuation (`>` is an arrow,
 * `[` opens an attribute, `#` starts a comment). Every one of those is listed
 * in `skipped` with the reason, so a caller can see what the code does not
 * cover instead of assuming the board was empty.
 *
 * ## The round trip
 *
 * `scene_to_dsl` followed by `apply_dsl` on a fresh board reproduces the
 * diagram's elements. Three things keep that true:
 *
 * - **The type is inferred**, because the type decides how a line is read (a
 *   colon is a field list in an ERD and part of a label elsewhere) and how a
 *   node is shaped. Inferring it from the elements means the code is written
 *   in the dialect that will read it back the same way.
 * - **Attributes are only written when they are not implied.** A flowchart's
 *   "Start" node is an ellipse because of its label, so writing
 *   `[shape: ellipse]` would be noise that a later edit could contradict; the
 *   same rule the forward direction uses (`defaultShapeFor`) decides.
 * - **Nodes are written in the scene's own order**, which is the order the
 *   layout stacks a column in. Re-applying therefore lays the diagram out
 *   where it already is.
 *
 * The one thing the language cannot express is *order across a group
 * boundary*: nodes inside a brace group have to be written together, so a
 * diagram whose groups interleave in the layout's order comes back with its
 * nodes in a different order, which can shift them within their column. That
 * is reported in `warnings` rather than left to be discovered.
 */

import { COLOR_PALETTE } from "@excalidraw/common";

import { slugify } from "@excalidraw/excalidraw/components/diagram/parser";
import {
  ICON_GLYPHS,
  NAMED_COLORS,
  defaultShapeFor,
  getDiagramTag,
} from "@excalidraw/excalidraw/components/diagram/scene";
import { ICON_FILE_ID_PREFIX } from "@excalidraw/excalidraw/components/icons/iconDrawing";

import type { DiagramType } from "@excalidraw/excalidraw/components/diagram/types";

import type {
  ExcalidrawElement,
  ExcalidrawFrameElement,
  ExcalidrawLinearElement,
} from "@excalidraw/element/types";

import { getBoard, toBoardMeta } from "./db.js";
import { MAX_DIAGRAM_CODE } from "./schemas.js";
import { readScene } from "./sceneEdit.js";
import { ToolError } from "./tools.js";

import type { OwnerIdentity, ServerOptions } from "./config.js";
import type { BoardMeta, Database } from "./db.js";

/** An element the generated code does not describe, and why. */
export type SkippedElement = {
  id: string;
  type: string;
  /** A sentence a model can repeat to the person. */
  reason: string;
};

/** What `scene_to_dsl` returns. */
export type SceneToDslResult = {
  board: BoardMeta;
  /** The dialect the code is written in. Pass it to `apply_dsl`. */
  type: DiagramType;
  /** The diagram in the pane's language. Empty when the board has none. */
  code: string;
  counts: { nodes: number; edges: number; groups: number };
  /** The elements the code does not cover, capped at {@link MAX_SKIPPED}. */
  skipped: SkippedElement[];
  /** How many were skipped; can exceed `skipped.length`. */
  skippedCount: number;
  /** What a caller should know before re-applying the code. */
  warnings: string[];
  message: string;
};

/** How many skipped elements are listed before the list is cut. */
const MAX_SKIPPED = 100;

/** One level of the code's indentation. */
const INDENT = "  ";

/**
 * Collapses a label the way the parser does.
 *
 * The parser trims and collapses internal whitespace before it derives a
 * node's identity, so a label that is not already in that form would come
 * back as a *different* node — same words, different slug, and the edges
 * would point at a node that no longer exists.
 */
const cleanLabel = (label: string): string => label.trim().replace(/\s+/g, " ");

/** The text a text element holds, or an empty string for anything else. */
const textOf = (element: ExcalidrawElement): string =>
  element.type === "text" ? element.originalText : "";

/** The image file id an element carries, if it is an image. */
const fileIdOf = (element: ExcalidrawElement): string | null =>
  element.type === "image" && typeof element.fileId === "string"
    ? element.fileId
    : null;

/** Whether an element names a library icon, which needs the catalogue to read. */
const isLibraryIcon = (element: ExcalidrawElement): boolean => {
  const fileId = fileIdOf(element);

  return Boolean(fileId?.startsWith(ICON_FILE_ID_PREFIX));
};

/**
 * The ids in the icon library, loaded the first time a board needs them.
 *
 * The catalogue is 23 KB of tile definitions, and only a board that has a
 * library icon on it needs any of it — a glyph icon is read from
 * `ICON_GLYPHS`, which is already in the entry chunk. So the import is
 * dynamic: esbuild emits it as a chunk of its own, read from disk on the first
 * call that needs it rather than at startup. The set is cached for the life of
 * the process; a failed load is not, so one transient read error does not
 * poison every later call.
 */
let iconLibrary: Set<string> | null = null;

const loadIconLibrary = async (): Promise<Set<string>> => {
  if (iconLibrary) {
    return iconLibrary;
  }

  const module = await import("@excalidraw/excalidraw/components/icons/icons");
  iconLibrary = new Set(module.ICONS.map((icon) => icon.id));

  return iconLibrary;
};

/**
 * The `[icon: ...]` value for an icon element.
 *
 * A glyph is matched back to the first name in the table that draws it — the
 * table has aliases (`database`, `db` and `storage` all draw the same glyph),
 * and any of them re-renders identically. A library icon is named by its id,
 * which `findIconByName` resolves back to the same tile.
 *
 * @param known whether an icon id is in the library. Passed in rather than
 *   imported, because the catalogue is a chunk of its own — see
 *   {@link loadIconLibrary}.
 */
const iconNameOf = (
  element: ExcalidrawElement,
  known: (id: string) => boolean,
): string | null => {
  if (element.type === "text") {
    const glyph = element.originalText.trim();

    for (const [name, candidate] of Object.entries(ICON_GLYPHS)) {
      if (candidate === glyph) {
        return name;
      }
    }

    return null;
  }

  const fileId = fileIdOf(element);

  if (!fileId?.startsWith(ICON_FILE_ID_PREFIX)) {
    return null;
  }

  const id = fileId.slice(ICON_FILE_ID_PREFIX.length);

  return known(id) ? id : null;
};

/**
 * The `[color: ...]` value for a node's colours, or null when they are the
 * default.
 *
 * The reverse of `resolveNodeColor`: a named colour is found again by the
 * pair of colours it produced, and a bare hex stroke (which the DSL takes as
 * given) is written back as itself. Anything else — a colour a person picked
 * from the palette on the canvas — has no name in the language, and is
 * reported rather than guessed at.
 */
const colorNameOf = (background: string, stroke: string): string | null => {
  if (
    background === COLOR_PALETTE.transparent &&
    stroke === COLOR_PALETTE.black
  ) {
    return null;
  }

  for (const [name, colors] of Object.entries(NAMED_COLORS)) {
    if (colors.background === background && colors.stroke === stroke) {
      return name;
    }
  }

  if (
    background === COLOR_PALETTE.transparent &&
    /^#[0-9a-f]{3,8}$/i.test(stroke)
  ) {
    return stroke.toLowerCase();
  }

  return null;
};

/** Splits a node label into its name and its ERD fields. */
const splitLabel = (text: string): { label: string; fields: string[] } => {
  const blank = text.indexOf("\n\n");

  if (blank === -1) {
    return { label: text.trim(), fields: [] };
  }

  return {
    label: text.slice(0, blank).trim(),
    fields: text
      .slice(blank + 2)
      .split("\n")
      .map((field) => field.trim())
      .filter(Boolean),
  };
};

/** A node, as the scene holds it. */
type NodeInfo = {
  /** the diagram node id, from the element's tag */
  key: string;
  element: ExcalidrawElement;
  /** position in the element list, which is the layout's own order */
  index: number;
  label: string;
  fields: string[];
  shape: "rectangle" | "ellipse" | "diamond";
  color: string | null;
  icon: string | null;
  /** the frame element id the node sits in, if any */
  frameId: string | null;
  /** why the node cannot be written, if it cannot */
  problem: string | null;
};

/** An edge, as the scene holds it. */
type EdgeInfo = {
  key: string;
  index: number;
  from: string | null;
  to: string | null;
  both: boolean;
  label: string | null;
  problem: string | null;
};

/** A brace group, as the scene holds it. */
type GroupInfo = {
  key: string;
  frame: ExcalidrawFrameElement;
  label: string;
  parentId: string | null;
  /** the frame's element index, for ordering */
  order: number;
  problem: string | null;
};

/** The diagram parts of a scene, in element order. */
type DiagramScene = {
  nodes: NodeInfo[];
  edges: EdgeInfo[];
  groups: GroupInfo[];
  /** whether the diagram has sequence lifelines */
  hasLifelines: boolean;
};

/** Whether `outer` fully contains `inner`. */
const contains = (
  outer: ExcalidrawElement,
  inner: ExcalidrawElement,
): boolean =>
  outer.x <= inner.x &&
  outer.y <= inner.y &&
  outer.x + outer.width >= inner.x + inner.width &&
  outer.y + outer.height >= inner.y + inner.height;

/**
 * Why a label cannot be written as a node, or null when it can.
 *
 * Each rule is something the parser would read as syntax rather than as
 * words, so writing the label would produce a different diagram — or a parse
 * error — rather than the same one.
 */
const nodeLabelProblem = (label: string, type: DiagramType): string | null => {
  if (!label) {
    return "it has no label, so the DSL has no name for it";
  }

  if (cleanLabel(label) !== label) {
    return "its label has leading, trailing or repeated spaces, which the DSL would collapse";
  }

  if (!slugify(label)) {
    return "its label has no letters or digits, so the DSL cannot name it";
  }

  if (label.startsWith("#")) {
    return "its label starts with #, which the DSL reads as a comment";
  }

  if (label.endsWith("{")) {
    return "its label ends with {, which the DSL reads as a group opening";
  }

  if (label === "}") {
    return "its label is }, which the DSL reads as a group closing";
  }

  if (/[[\]]/.test(label)) {
    return "its label contains [ or ], which the DSL reads as an attribute";
  }

  if (/[<>]/.test(label)) {
    return "its label contains < or >, which the DSL reads as an arrow";
  }

  if (type === "erd" && label.includes(":")) {
    return "its label contains :, which an ERD reads as the start of its fields";
  }

  return null;
};

/** Why a node's ERD fields cannot be written, or null when they can. */
const fieldsProblem = (fields: readonly string[]): string | null => {
  for (const field of fields) {
    if (!field) {
      return "one of its fields is empty, which the DSL would drop";
    }

    if (cleanLabel(field) !== field) {
      return "one of its fields has leading, trailing or repeated spaces, which the DSL would collapse";
    }

    if (field.includes(",")) {
      return "one of its fields contains a comma, which the DSL reads as a field separator";
    }

    if (/[[\]<>]/.test(field)) {
      return "one of its fields contains <, >, [ or ], which the DSL reads as syntax";
    }
  }

  return null;
};

/** Why an edge label cannot be written, or null when it can. */
const edgeLabelProblem = (label: string): string | null => {
  if (cleanLabel(label) !== label) {
    return "its label has leading, trailing or repeated spaces, which the DSL would collapse";
  }

  if (label.includes(":")) {
    return "its label contains :, which the DSL reads as the start of a field list";
  }

  if (/[<>[\]]/.test(label)) {
    return "its label contains <, >, [ or ], which the DSL reads as syntax";
  }

  return null;
};

/** Why a group name cannot be written, or null when it can. */
const groupLabelProblem = (label: string): string | null => {
  if (!label) {
    return "the group frame has no name, so the DSL has nothing to open it with";
  }

  if (cleanLabel(label) !== label) {
    return "its name has leading, trailing or repeated spaces, which the DSL would collapse";
  }

  if (!slugify(label)) {
    return "its name has no letters or digits, so the DSL cannot name it";
  }

  if (label.startsWith("#")) {
    return "its name starts with #, which the DSL reads as a comment";
  }

  if (label.endsWith("{")) {
    return "its name ends with {, which the DSL reads as a group opening";
  }

  return null;
};

/**
 * The endpoints an edge id encodes.
 *
 * `a->b` is directional; `a<->b` is two-way and sorts its endpoints, so the
 * order here is arbitrary but stable. Used only when the arrow's bindings are
 * missing — which happens for an edge the engine could not bind, such as a
 * self-edge.
 */
const parseEdgeKey = (
  key: string,
): { from: string | null; to: string | null; both: boolean } => {
  const twoWay = key.indexOf("<->");

  if (twoWay !== -1) {
    return {
      from: key.slice(0, twoWay) || null,
      to: key.slice(twoWay + 3) || null,
      both: true,
    };
  }

  const forward = key.indexOf("->");

  if (forward === -1) {
    return { from: null, to: null, both: false };
  }

  return {
    from: key.slice(0, forward) || null,
    to: key.slice(forward + 2) || null,
    both: false,
  };
};

/**
 * Reads the diagram out of a scene.
 *
 * Two passes: the first gathers what belongs to a node — its label, its icon,
 * an edge's label — because those elements come after the shape that owns
 * them; the second builds the nodes, edges and groups themselves.
 */
const collect = (
  elements: readonly ExcalidrawElement[],
  type: DiagramType,
  knownIcon: (id: string) => boolean,
): DiagramScene => {
  const labels = new Map<string, string>();
  const icons = new Map<string, string>();
  const edgeLabels = new Map<string, string>();
  const nodeIdsByElement = new Map<string, string>();

  let hasLifelines = false;

  for (const element of elements) {
    const tag = getDiagramTag(element);

    if (!tag) {
      continue;
    }

    switch (tag.diagramRole) {
      case "label":
        if (tag.diagramNode) {
          labels.set(tag.diagramNode, textOf(element));
        }
        break;
      case "icon": {
        if (!tag.diagramNode) {
          break;
        }
        const name = iconNameOf(element, knownIcon);
        if (name) {
          icons.set(tag.diagramNode, name);
        }
        break;
      }
      case "edge-label":
        if (tag.diagramEdge) {
          edgeLabels.set(tag.diagramEdge, textOf(element));
        }
        break;
      case "lifeline":
        hasLifelines = true;
        break;
      case "node":
        if (tag.diagramNode) {
          nodeIdsByElement.set(element.id, tag.diagramNode);
        }
        break;
    }
  }

  const nodes: NodeInfo[] = [];
  const edges: EdgeInfo[] = [];
  const groups: GroupInfo[] = [];

  elements.forEach((element, index) => {
    const tag = getDiagramTag(element);

    if (!tag) {
      return;
    }

    if (tag.diagramRole === "group" && tag.diagramGroup) {
      if (element.type !== "frame") {
        return;
      }

      const label = cleanLabel(element.name ?? "");

      groups.push({
        key: tag.diagramGroup,
        frame: element,
        label,
        parentId: null,
        order: index,
        problem: groupLabelProblem(label),
      });
      return;
    }

    if (tag.diagramRole === "node" && tag.diagramNode) {
      const text = labels.get(tag.diagramNode) ?? "";
      const { label, fields } = splitLabel(text);
      const shape =
        element.type === "ellipse" || element.type === "diamond"
          ? element.type
          : "rectangle";

      const problem =
        nodeLabelProblem(label, type) ??
        (type === "erd" ? fieldsProblem(fields) : null);

      nodes.push({
        key: tag.diagramNode,
        element,
        index,
        label,
        fields,
        shape,
        color: colorNameOf(element.backgroundColor, element.strokeColor),
        icon: icons.get(tag.diagramNode) ?? null,
        frameId: element.frameId ?? null,
        problem,
      });
      return;
    }

    if (tag.diagramRole === "edge" && tag.diagramEdge) {
      // The bindings are the trustworthy direction: a two-way edge's id is
      // its endpoints sorted, so parsing the id would lose which end is
      // which. They are absent only for an edge the engine could not bind,
      // and then the id is all there is.
      const linear = element as ExcalidrawLinearElement;
      const startId = linear.startBinding?.elementId;
      const endId = linear.endBinding?.elementId;

      let from = startId ? nodeIdsByElement.get(startId) ?? null : null;
      let to = endId ? nodeIdsByElement.get(endId) ?? null : null;

      if (!from || !to) {
        const parsed = parseEdgeKey(tag.diagramEdge);
        from = from ?? parsed.from;
        to = to ?? parsed.to;
      }

      const label = edgeLabels.get(tag.diagramEdge) ?? null;

      edges.push({
        key: tag.diagramEdge,
        index,
        from,
        to,
        both: element.type === "arrow" && element.startArrowhead !== null,
        label,
        problem: label ? edgeLabelProblem(label) : null,
      });
    }
  });

  // A group's parent is the smallest frame that contains it. The frames are
  // laid out around their members, so containment is exactly the nesting the
  // code had.
  for (const group of groups) {
    let parent: GroupInfo | null = null;

    for (const candidate of groups) {
      if (candidate === group || !contains(candidate.frame, group.frame)) {
        continue;
      }

      if (
        !parent ||
        candidate.frame.width * candidate.frame.height <
          parent.frame.width * parent.frame.height
      ) {
        parent = candidate;
      }
    }

    group.parentId = parent?.key ?? null;
  }

  return { nodes, edges, groups, hasLifelines };
};

/**
 * The dialect the code should be written in.
 *
 * Read off the elements, because the type is what decides how a line will be
 * read back: an ERD's labels carry a field block, a sequence diagram has
 * lifelines, and a flowchart is the only one whose nodes are shaped by their
 * own words. Everything else is an architecture diagram, which is the
 * unshaped default.
 */
const inferType = (scene: DiagramScene): DiagramType => {
  if (scene.hasLifelines) {
    return "sequence";
  }

  if (scene.nodes.some((node) => node.fields.length > 0)) {
    return "erd";
  }

  if (
    scene.nodes.some(
      (node) =>
        node.shape === "diamond" ||
        (node.shape === "ellipse" &&
          defaultShapeFor(node.label, "flowchart") === "ellipse"),
    )
  ) {
    return "flowchart";
  }

  return "architecture";
};

/** The line that declares a node. */
const nodeLine = (node: NodeInfo, type: DiagramType): string => {
  const attributes: string[] = [];

  if (node.icon) {
    attributes.push(`[icon: ${node.icon}]`);
  }

  if (node.color) {
    attributes.push(`[color: ${node.color}]`);
  }

  // A sequence participant is always a rectangle, whatever the label says.
  const implied =
    type === "sequence" ? "rectangle" : defaultShapeFor(node.label, type);

  if (node.shape !== implied) {
    attributes.push(`[shape: ${node.shape}]`);
  }

  const text =
    type === "erd" && node.fields.length
      ? `${node.label}: ${node.fields.join(", ")}`
      : node.label;

  return attributes.length ? `${text} ${attributes.join(" ")}` : text;
};

/** The frame a node sits in, as a group key, or null when it sits in none. */
const groupKeyForFrame = (
  scene: DiagramScene,
  frameId: string | null,
): string | null => {
  if (!frameId) {
    return null;
  }

  for (const group of scene.groups) {
    if (group.frame.id === frameId) {
      return group.key;
    }
  }

  return null;
};

/**
 * Writes the code.
 *
 * Nodes are emitted in the scene's own order — which is the layout's order,
 * so re-applying reproduces their positions — except where a brace group
 * forces neighbours together. That exception is what the caller is warned
 * about.
 */
const writeCode = (
  scene: DiagramScene,
  type: DiagramType,
): { code: string; emitted: string[] } => {
  const lines: string[] = [];
  const emitted: string[] = [];

  const frameOf = (node: NodeInfo): string | null =>
    groupKeyForFrame(scene, node.frameId);

  /**
   * Writes everything that belongs at one brace level.
   *
   * `parentId` is the group whose members this level holds — `null` for the
   * top. A group that cannot be opened contributes its members here rather
   * than losing them.
   */
  const writeLevel = (parentId: string | null, depth: number) => {
    const pad = INDENT.repeat(depth);
    const units: { order: number; write: () => void }[] = [];

    for (const group of scene.groups) {
      if (group.parentId !== parentId) {
        continue;
      }

      const members = scene.nodes.filter((node) => frameOf(node) === group.key);
      const order = Math.min(
        group.order,
        ...members.map((member) => member.index),
      );

      units.push({
        order,
        write: () => {
          if (group.problem) {
            // A group that cannot be named cannot be opened. Its members are
            // written at this level rather than lost with it.
            writeLevel(group.key, depth);
            return;
          }

          lines.push(`${pad}${group.label} {`);
          writeLevel(group.key, depth + 1);
          lines.push(`${pad}}`);
        },
      });
    }

    for (const node of scene.nodes) {
      if (frameOf(node) !== parentId) {
        continue;
      }

      units.push({
        order: node.index,
        write: () => {
          lines.push(`${pad}${nodeLine(node, type)}`);
          emitted.push(node.key);
        },
      });
    }

    units.sort((a, b) => a.order - b.order);

    for (const unit of units) {
      unit.write();
    }
  };

  writeLevel(null, 0);

  if (lines.length && scene.edges.length) {
    lines.push("");
  }

  const labels = new Map(scene.nodes.map((node) => [node.key, node.label]));

  for (const edge of scene.edges) {
    const from = edge.from ? labels.get(edge.from) : undefined;
    const to = edge.to ? labels.get(edge.to) : undefined;

    if (!from || !to) {
      continue;
    }

    const arrow = edge.both ? "<>" : ">";
    const label = edge.label ? `: ${edge.label}` : "";

    lines.push(`${from} ${arrow} ${to}${label}`);
  }

  return { code: lines.join("\n"), emitted };
};

/**
 * Reads a board's diagram back into the pane's language.
 *
 * The board is read under the caller's owner scope, so a board that is not
 * theirs is reported as missing — the same answer `get_board` gives, for the
 * same reason.
 */
export const runSceneToDsl = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  boardId: string,
): Promise<SceneToDslResult> => {
  const row = await getBoard(db, owner, boardId);

  if (!row) {
    throw new ToolError(
      `No board with id ${boardId} is visible to this server. It may not ` +
        "exist, or it may belong to another owner.",
    );
  }

  const sceneBytes = row.scene ? Buffer.byteLength(row.scene, "utf8") : 0;

  if (sceneBytes > options.maxSceneBytes) {
    throw new ToolError(
      `Board ${boardId}'s scene is ${sceneBytes} bytes, above the ` +
        `${options.maxSceneBytes}-byte limit this server will parse ` +
        "(MOSAIC_MCP_MAX_SCENE_BYTES). Nothing was read. Raise that limit if " +
        "the board is legitimately this large.",
    );
  }

  const scene = readScene(row.scene);
  const visible = scene.elements.filter((element) => !element.isDeleted);

  // The icon catalogue is a chunk, so it is only read when the board actually
  // has a library icon on it. `known` is still synchronous, because the
  // collector is: the load happens here, before the scene is walked.
  const icons = visible.some(isLibraryIcon) ? await loadIconLibrary() : null;
  const knownIcon = (id: string) => icons?.has(id) ?? false;

  // The type has to be known before the nodes are read: an ERD's label is
  // split into a name and fields, and every other type's is not.
  const firstPass = collect(visible, "architecture", knownIcon);
  const type = inferType(firstPass);
  const diagram =
    type === "architecture" ? firstPass : collect(visible, type, knownIcon);

  const skipped: SkippedElement[] = [];

  const skip = (element: ExcalidrawElement, reason: string) => {
    skipped.push({ id: element.id, type: element.type, reason });
  };

  // Everything that is not a diagram element is outside the language.
  for (const element of visible) {
    if (!getDiagramTag(element)) {
      skip(
        element,
        "it was drawn by hand, not by the diagram pane, so the DSL has no way to express it",
      );
    }
  }

  // A node the language cannot name takes its edges with it: an arrow to a
  // node that is not in the code has nothing to attach to.
  const written = new Set<string>();

  for (const node of diagram.nodes) {
    if (node.problem) {
      skip(node.element, node.problem);
      continue;
    }

    if (written.has(node.key)) {
      skip(
        node.element,
        "another node already has this label, and the DSL would read both as one node",
      );
      continue;
    }

    written.add(node.key);
  }

  for (const group of diagram.groups) {
    if (group.problem) {
      skip(group.frame, group.problem);
    }
  }

  const arrowElements = new Map<string, ExcalidrawElement>();

  for (const element of visible) {
    const tag = getDiagramTag(element);

    if (tag?.diagramRole === "edge" && tag.diagramEdge) {
      arrowElements.set(tag.diagramEdge, element);
    }
  }

  const writtenEdges: EdgeInfo[] = [];

  for (const edge of diagram.edges) {
    const element = arrowElements.get(edge.key);

    if (!element) {
      continue;
    }

    if (edge.problem) {
      skip(element, edge.problem);
      continue;
    }

    if (!edge.from || !edge.to) {
      skip(
        element,
        "its endpoints could not be read from the board, so the DSL cannot name them",
      );
      continue;
    }

    if (!written.has(edge.from) || !written.has(edge.to)) {
      skip(
        element,
        "one of the nodes it connects is not in the code, so the arrow has nothing to attach to",
      );
      continue;
    }

    writtenEdges.push(edge);
  }

  const writtenNodes = diagram.nodes.filter((node) => written.has(node.key));
  const { code, emitted } = writeCode(
    { ...diagram, nodes: writtenNodes, edges: writtenEdges },
    type,
  );

  if (code.length > MAX_DIAGRAM_CODE) {
    throw new ToolError(
      `The diagram on board ${boardId} is too large to write as code: it ` +
        `would be ${code.length} characters, above the ${MAX_DIAGRAM_CODE} ` +
        "this server accepts. Nothing was returned. Split the diagram, or " +
        "read the board with get_board instead.",
    );
  }

  const warnings: string[] = [];

  if (!code) {
    warnings.push(
      "This board has no diagram, so the code is empty. apply_dsl would " +
        "refuse it; there is nothing to apply.",
    );
  }

  // Only warn when the code really does declare the nodes in a different
  // order from the scene: a diagram whose groups already come last is
  // reproduced exactly, and warning about it would be noise.
  const sceneOrder = writtenNodes.map((node) => node.key);

  if (emitted.some((key, position) => key !== sceneOrder[position])) {
    warnings.push(
      "This diagram has brace groups, and the code has to write each " +
        "group's nodes together. Re-applying it may move some nodes within " +
        "their column, because the layout stacks a column in the order the " +
        "code declares them.",
    );
  }

  return {
    board: toBoardMeta(row),
    type,
    code,
    counts: {
      nodes: writtenNodes.length,
      edges: writtenEdges.length,
      groups: diagram.groups.filter((group) => !group.problem).length,
    },
    skipped: skipped.slice(0, MAX_SKIPPED),
    skippedCount: skipped.length,
    warnings,
    message: code
      ? `${
          `Read a ${type} diagram from board "${row.name}": ` +
          `${writtenNodes.length} node${
            writtenNodes.length === 1 ? "" : "s"
          }, ` +
          `${writtenEdges.length} edge${
            writtenEdges.length === 1 ? "" : "s"
          }, ` +
          `${diagram.groups.length} group` +
          `${diagram.groups.length === 1 ? "" : "s"}.`
        }${
          skipped.length
            ? ` ${skipped.length} element${
                skipped.length === 1 ? "" : "s"
              } on the board ${
                skipped.length === 1 ? "is" : "are"
              } not in the code.`
            : ""
        }`
      : `Board "${row.name}" has no diagram to read.`,
  };
};
