import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The Venn diagram: three circles that overlap, and the work that only
 * becomes possible where they meet.
 *
 * The circles are drawn as outlines rather than as filled discs, so that the
 * overlap stays visible.
 */

const CIRCLE_SIZE = 320;

const PRODUCT = { x: 80, y: 120 };
const MARKETING = { x: 280, y: 120 };
const SALES = { x: 180, y: 240 };

const NOTE: PanelBlock = {
  id: "note",
  title: "Read it as",
  x: 560,
  y: 140,
  width: 420,
  height: 180,
  background: COLOR_PALETTE.gray[0],
  stroke: COLOR_PALETTE.gray[3],
  items: [
    "Where two circles meet is work the two of them do together.",
    "The middle is the work only all three can do.",
    "Name the middle, or admit there is none.",
  ],
};

export const vennDiagramTemplate: ExcalidrawTemplate = {
  id: "venn-diagram",
  nameKey: "labels.templates.items.vennDiagram.name",
  descriptionKey: "labels.templates.items.vennDiagram.description",
  category: "diagramming",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Venn Diagram",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Three circles, three overlaps. The middle is usually the interesting part.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "ellipse",
      id: "product",
      x: PRODUCT.x,
      y: PRODUCT.y,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      strokeColor: COLOR_PALETTE.blue[3],
      strokeWidth: 2,
    },
    {
      kind: "ellipse",
      id: "marketing",
      x: MARKETING.x,
      y: MARKETING.y,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      strokeColor: COLOR_PALETTE.orange[3],
      strokeWidth: 2,
    },
    {
      kind: "ellipse",
      id: "sales",
      x: SALES.x,
      y: SALES.y,
      width: CIRCLE_SIZE,
      height: CIRCLE_SIZE,
      strokeColor: COLOR_PALETTE.green[3],
      strokeWidth: 2,
    },
    {
      kind: "text",
      id: "label-product",
      x: 110,
      y: 240,
      width: 120,
      height: 24,
      text: "Product",
      fontSize: 18,
    },
    {
      kind: "text",
      id: "label-marketing",
      x: 460,
      y: 240,
      width: 120,
      height: 24,
      text: "Marketing",
      fontSize: 18,
    },
    {
      kind: "text",
      id: "label-sales",
      x: 290,
      y: 500,
      width: 120,
      height: 24,
      text: "Sales",
      fontSize: 18,
    },
    {
      kind: "text",
      id: "label-middle",
      x: 280,
      y: 306,
      width: 120,
      height: 24,
      text: "All three",
      fontSize: 16,
      align: "center",
      color: COLOR_PALETTE.gray[4],
    },
    ...panelElements(NOTE),
  ],
};
