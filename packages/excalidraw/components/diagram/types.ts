/**
 * The shapes a diagram written in the code pane takes.
 *
 * The parser produces a model that knows nothing about the canvas: nodes,
 * edges and groups, each carrying the position of its own text in the
 * source. The layout turns the model into rectangles, and the scene builder
 * turns those into elements. Keeping the three apart is what makes the
 * parser and the layout testable without a browser.
 */

import type { DiagramType } from "../../types";

export type { DiagramType };

/** a node, as written in the code */
export type DiagramNode = {
  /** stable identity, derived from the label */
  id: string;
  label: string;
  icon?: string;
  color?: string;
  shape?: "rectangle" | "ellipse" | "diamond";
  /** ERD only: the fields listed after the colon */
  fields: string[];
  /** the innermost group the node was written inside, if any */
  groupId: string | null;
  /** 1-based line the node was declared on */
  line: number;
  /** the span of the label within the raw line, so a rename can splice it */
  labelStart: number;
  labelEnd: number;
  /** declared by an edge rather than by a line of its own */
  implicit: boolean;
};

/** a directed (or two-way) edge between two nodes */
export type DiagramEdge = {
  /** stable identity: `from->to`, or `a<->b` for a two-way edge */
  id: string;
  from: string;
  to: string;
  both: boolean;
  label?: string;
  line: number;
  fromStart: number;
  fromEnd: number;
  toStart: number;
  toEnd: number;
  labelStart: number;
  labelEnd: number;
};

/** a brace block, rendered as a container around its members */
export type DiagramGroup = {
  /** stable identity: the slug of the group path */
  id: string;
  label: string;
  parentId: string | null;
  /** nesting depth, 0 for a top-level group */
  depth: number;
  line: number;
  labelStart: number;
  labelEnd: number;
};

export type DiagramModel = {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  groups: DiagramGroup[];
};

export type DiagramParseError = {
  /** 1-based line number */
  line: number;
  message: string;
};

export type DiagramParseResult = {
  model: DiagramModel;
  errors: DiagramParseError[];
};

/** a rectangle on the canvas, in scene coordinates */
export type DiagramRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** where a node ended up */
export type LaidOutNode = DiagramRect & {
  id: string;
};

/** where a group's container ended up */
export type LaidOutGroup = DiagramRect & {
  id: string;
  label: string;
  depth: number;
};

/** where an edge's arrow runs */
export type LaidOutEdge = {
  id: string;
  from: string;
  to: string;
  both: boolean;
  label?: string;
  start: { x: number; y: number };
  end: { x: number; y: number };
};

/** a sequence diagram's participant column */
export type LaidOutParticipant = DiagramRect & {
  id: string;
  /** the vertical lifeline below the participant */
  lifeline: { x: number; y: number; height: number };
};

export type DiagramLayout = {
  nodes: LaidOutNode[];
  groups: LaidOutGroup[];
  edges: LaidOutEdge[];
  participants: LaidOutParticipant[];
  /** the bounds the whole diagram occupies */
  bounds: DiagramRect;
};
