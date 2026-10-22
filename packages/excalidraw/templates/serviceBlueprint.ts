import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The service blueprint: what the customer does, what the team does in front
 * of them, what the team does behind, and the systems that make it possible.
 *
 * The four rows are read against the stages of the journey, so a cell is
 * always "this stage, this layer".
 */

const LABEL_WIDTH = 170;
const FIRST_COLUMN_X = 40;

const CELL_WIDTH = 200;
const CELL_GAP = 20;
const FIRST_CELL_X = FIRST_COLUMN_X + LABEL_WIDTH + 12;

const CELL_HEIGHT = 104;
const FIRST_CELL_Y = 150;
const ROW_GAP = 12;

const STAGES = ["1. Discover", "2. Buy", "3. Deliver", "4. Support"];

const ROWS: (PanelBlock & { stage: string[] })[] = [
  {
    id: "customer",
    title: "Customer actions",
    x: FIRST_COLUMN_X,
    y: FIRST_CELL_Y,
    width: LABEL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    items: ["What the customer does"],
    stage: [
      "Searches for a tool",
      "Asks a colleague",
      "Reads the reviews",
      "Asks for help",
    ],
  },
  {
    id: "frontstage",
    title: "Frontstage",
    x: FIRST_COLUMN_X,
    y: FIRST_CELL_Y + CELL_HEIGHT + ROW_GAP,
    width: LABEL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: ["What the customer sees"],
    stage: [
      "Homepage and pricing",
      "A chat with us",
      "Onboarding emails",
      "The help centre",
    ],
  },
  {
    id: "backstage",
    title: "Backstage",
    x: FIRST_COLUMN_X,
    y: FIRST_CELL_Y + (CELL_HEIGHT + ROW_GAP) * 2,
    width: LABEL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.violet[0],
    stroke: COLOR_PALETTE.violet[2],
    items: ["What the team does"],
    stage: [
      "Prepares the trial",
      "Checks the invoice",
      "Prepares the account",
      "Escalates the ticket",
    ],
  },
  {
    id: "support",
    title: "Support systems",
    x: FIRST_COLUMN_X,
    y: FIRST_CELL_Y + (CELL_HEIGHT + ROW_GAP) * 3,
    width: LABEL_WIDTH,
    height: CELL_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["What makes it work"],
    stage: [
      "Search ranking",
      "CRM and billing",
      "Account service",
      "The ticketing system",
    ],
  },
];

export const serviceBlueprintTemplate: ExcalidrawTemplate = {
  id: "service-blueprint",
  nameKey: "labels.templates.items.serviceBlueprint.name",
  descriptionKey: "labels.templates.items.serviceBlueprint.description",
  category: "research",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Service Blueprint",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "One row per layer, one column per stage of the journey.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...STAGES.map((stage, index) => ({
      kind: "text" as const,
      id: `stage-${index + 1}`,
      x: FIRST_CELL_X + index * (CELL_WIDTH + CELL_GAP),
      y: 116,
      width: CELL_WIDTH,
      height: 22,
      text: stage,
      fontSize: 16,
    })),
    ...ROWS.flatMap((row) => [
      ...panelElements({
        id: row.id,
        title: row.title,
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        background: row.background,
        stroke: row.stroke,
        items: row.items,
      }),
      ...row.stage.flatMap((entry, index) =>
        panelElements({
          id: `${row.id}-cell-${index + 1}`,
          title: "",
          x: FIRST_CELL_X + index * (CELL_WIDTH + CELL_GAP),
          y: row.y,
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
          background: COLOR_PALETTE.white,
          stroke: COLOR_PALETTE.gray[2],
          items: [entry],
        }),
      ),
    ]),
  ],
};
