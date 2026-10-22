import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The Eisenhower matrix: the work sorted by how important it is and how
 * urgent it is, so the order of the queue is an argument you can have once
 * rather than every day.
 */

const CELL_WIDTH = 280;
const CELL_HEIGHT = 210;
const CELL_GAP = 20;
const FIRST_CELL_X = 150;
const FIRST_CELL_Y = 140;

const QUADRANTS: PanelBlock[] = [
  {
    id: "schedule",
    title: "Schedule",
    x: FIRST_CELL_X,
    y: FIRST_CELL_Y,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    titleFontSize: 18,
    items: [
      "Important, not urgent",
      "Redesign the settings page",
      "Add single sign-on",
    ],
  },
  {
    id: "do-now",
    title: "Do now",
    x: FIRST_CELL_X + CELL_WIDTH + CELL_GAP,
    y: FIRST_CELL_Y,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    titleFontSize: 18,
    items: [
      "Important and urgent",
      "Ship the template gallery",
      "Fix the preview on dark",
    ],
  },
  {
    id: "delete",
    title: "Delete",
    x: FIRST_CELL_X,
    y: FIRST_CELL_Y + CELL_HEIGHT + CELL_GAP,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    titleFontSize: 18,
    items: [
      "Neither important nor urgent",
      "A second notification centre",
      "Chase the old spreadsheets",
    ],
  },
  {
    id: "delegate",
    title: "Delegate",
    x: FIRST_CELL_X + CELL_WIDTH + CELL_GAP,
    y: FIRST_CELL_Y + CELL_HEIGHT + CELL_GAP,
    width: CELL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    titleFontSize: 18,
    items: [
      "Urgent, not important",
      "Write the release notes",
      "Update the help centre",
    ],
  },
];

export const prioritizationMatrixTemplate: ExcalidrawTemplate = {
  id: "prioritization-matrix",
  nameKey: "labels.templates.items.prioritizationMatrix.name",
  descriptionKey: "labels.templates.items.prioritizationMatrix.description",
  category: "strategy",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Prioritization Matrix",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Importance runs down the side, urgency runs across. Put the work where it belongs, then read the top right first.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...QUADRANTS.flatMap(panelElements),
    {
      kind: "text",
      id: "row-label-top",
      x: 40,
      y: FIRST_CELL_Y + 90,
      width: 100,
      height: 20,
      text: "Important",
      fontSize: 14,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "row-label-bottom",
      x: 40,
      y: FIRST_CELL_Y + CELL_HEIGHT + CELL_GAP + 90,
      width: 100,
      height: 20,
      text: "Not important",
      fontSize: 14,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "column-label-left",
      x: FIRST_CELL_X,
      y: FIRST_CELL_Y + 2 * CELL_HEIGHT + CELL_GAP + 16,
      width: CELL_WIDTH,
      height: 20,
      text: "Not urgent",
      fontSize: 14,
      align: "center",
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "column-label-right",
      x: FIRST_CELL_X + CELL_WIDTH + CELL_GAP,
      y: FIRST_CELL_Y + 2 * CELL_HEIGHT + CELL_GAP + 16,
      width: CELL_WIDTH,
      height: 20,
      text: "Urgent",
      fontSize: 14,
      align: "center",
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
