/**
 * The vocabulary of the templates gallery: what a template is, what a
 * template is made of, and the categories the gallery groups them in.
 *
 * A template is *data*, not elements. It is a list of element specs — the
 * shapes and the words of the template — which the builder turns into real
 * elements when the template is used. Keeping the two apart is what lets the
 * gallery draw a preview of a template without building it, and lets a
 * template be edited as a readable list rather than as a pile of element
 * JSON.
 */

import type { StickyNoteHueName } from "@excalidraw/common";

import type { TranslationKeys } from "../i18n";

/**
 * The categories the gallery groups templates in, in the order the filter
 * tabs list them.
 *
 * ORDER matters: it is the order the tabs appear in.
 */
export const TEMPLATE_CATEGORY_IDS = [
  "meetings",
  "ideation",
  "research",
  "agile",
  "strategy",
  "diagramming",
] as const;

export type TemplateCategoryId = typeof TEMPLATE_CATEGORY_IDS[number];

/** a category, with the label the gallery shows for it */
export type TemplateCategory = {
  id: TemplateCategoryId;
  labelKey: TranslationKeys;
};

export type TemplateTextAlign = "left" | "center" | "right";

export type TemplateStrokeStyle = "solid" | "dashed" | "dotted";

/** the fields every element of a template has */
type TemplateElementBase = {
  /**
   * the element's identity within the template — unique per template, and
   * used to derive the element's id when the template is built
   */
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /**
   * the id of the frame of this template the element belongs to, if any.
   * The frame is named by the id of *its* spec.
   */
  inFrame?: string;
};

/** a paper the template's content sits on */
export type TemplateFrameSpec = TemplateElementBase & {
  kind: "frame";
  name?: string;
  /** the paper's fill; `transparent` for an unpainted canvas */
  fill?: string;
};

/** a shape — a card, a column, a box on a diagram */
export type TemplateShapeSpec = TemplateElementBase & {
  kind: "rectangle" | "ellipse" | "diamond";
  /** the shape's label, bound to the shape as its text */
  label?: string;
  backgroundColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: TemplateStrokeStyle;
  /** whether the shape's corners are rounded */
  roundness?: boolean;
  fontSize?: number;
  textColor?: string;
  textAlign?: TemplateTextAlign;
  /** the label's placement inside the shape */
  verticalAlign?: "top" | "middle" | "bottom";
};

/** a sticky note — the note the templates are built out of */
export type TemplateStickySpec = TemplateElementBase & {
  kind: "sticky";
  text: string;
  /** the paper the note is printed on */
  hue?: StickyNoteHueName;
  fontSize?: number;
  textAlign?: TemplateTextAlign;
  /** the note's tags, shown as a row of pills under its label */
  tags?: readonly string[];
};

/** a run of text standing on its own — a heading, a caption */
export type TemplateTextSpec = TemplateElementBase & {
  kind: "text";
  text: string;
  fontSize?: number;
  color?: string;
  align?: TemplateTextAlign;
  bold?: boolean;
};

/** an arrow between two points */
export type TemplateArrowSpec = {
  kind: "arrow";
  id: string;
  /** where the arrow starts */
  x: number;
  y: number;
  /** how far the arrow reaches, relative to its start */
  dx: number;
  dy: number;
  strokeColor?: string;
  strokeWidth?: number;
  strokeStyle?: TemplateStrokeStyle;
  /** whether the arrow's head is drawn */
  arrowhead?: boolean;
  /** the id of the frame of this template the arrow belongs to, if any */
  inFrame?: string;
};

export type TemplateElementSpec =
  | TemplateFrameSpec
  | TemplateShapeSpec
  | TemplateStickySpec
  | TemplateTextSpec
  | TemplateArrowSpec;

/**
 * A template: a name, a line about it, the category it belongs to, and the
 * elements it is made of.
 */
export type ExcalidrawTemplate = {
  id: string;
  nameKey: TranslationKeys;
  descriptionKey: TranslationKeys;
  category: TemplateCategoryId;
  elements: readonly TemplateElementSpec[];
};

/** the categories, in the order the filter tabs list them */
export const TEMPLATE_CATEGORIES: readonly TemplateCategory[] = [
  { id: "meetings", labelKey: "labels.templates.categories.meetings" },
  { id: "ideation", labelKey: "labels.templates.categories.ideation" },
  { id: "research", labelKey: "labels.templates.categories.research" },
  { id: "agile", labelKey: "labels.templates.categories.agile" },
  { id: "strategy", labelKey: "labels.templates.categories.strategy" },
  { id: "diagramming", labelKey: "labels.templates.categories.diagramming" },
];
