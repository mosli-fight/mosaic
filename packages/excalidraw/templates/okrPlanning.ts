import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The OKR plan: one objective, three key results that say whether it was
 * reached, and the initiatives that are meant to move each of them.
 */

const COLUMN_WIDTH = 290;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;

const OBJECTIVE: PanelBlock = {
  id: "objective",
  title: "Objective",
  x: FIRST_COLUMN_X,
  y: 100,
  width: COLUMN_WIDTH * 3 + COLUMN_GAP * 2,
  height: 80,
  background: COLOR_PALETTE.violet[0],
  stroke: COLOR_PALETTE.violet[2],
  titleFontSize: 18,
  items: ["Make the gallery the fastest way to start a board"],
};

const RESULTS: (PanelBlock & { initiatives: string[] })[] = [
  {
    id: "kr1",
    title: "Key result 1",
    x: FIRST_COLUMN_X,
    y: 210,
    width: COLUMN_WIDTH,
    height: 150,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    titleFontSize: 16,
    items: ["70% of new boards start from a template"],
    initiatives: ["Ship 20 more templates", "Name a template of the week"],
  },
  {
    id: "kr2",
    title: "Key result 2",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: 210,
    width: COLUMN_WIDTH,
    height: 150,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    titleFontSize: 16,
    items: ["Time to the first board under 2 minutes"],
    initiatives: [
      "Move the catalogue to its own chunk",
      "Cache the last board",
    ],
  },
  {
    id: "kr3",
    title: "Key result 3",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: 210,
    width: COLUMN_WIDTH,
    height: 150,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    titleFontSize: 16,
    items: ["4.5 out of 5 in the gallery survey"],
    initiatives: ["Ask after the third board", "Fix the three slowest steps"],
  },
];

const INITIATIVE_HEIGHT = 66;
const INITIATIVE_GAP = 12;
const FIRST_INITIATIVE_Y = 384;

const resultElements = (
  result: typeof RESULTS[number],
): TemplateElementSpec[] =>
  result.initiatives.flatMap((initiative, index) =>
    panelElements({
      id: `${result.id}-initiative-${index + 1}`,
      title: initiative,
      x: result.x,
      y: FIRST_INITIATIVE_Y + index * (INITIATIVE_HEIGHT + INITIATIVE_GAP),
      width: COLUMN_WIDTH,
      height: INITIATIVE_HEIGHT,
      titleFontSize: 14,
      background: COLOR_PALETTE.white,
      stroke: COLOR_PALETTE.gray[2],
    }),
  );

export const okrPlanningTemplate: ExcalidrawTemplate = {
  id: "okr-planning",
  nameKey: "labels.templates.items.okrPlanning.name",
  descriptionKey: "labels.templates.items.okrPlanning.description",
  category: "strategy",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "OKR Planning",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "An objective worth aiming at, key results that say whether it landed, and the work that moves them.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...panelElements(OBJECTIVE),
    ...RESULTS.flatMap((result) => [
      ...panelElements({
        id: result.id,
        title: result.title,
        x: result.x,
        y: result.y,
        width: result.width,
        height: result.height,
        background: result.background,
        stroke: result.stroke,
        titleFontSize: result.titleFontSize,
        items: result.items,
      }),
      ...resultElements(result),
    ]),
    {
      kind: "text",
      id: "initiatives-label",
      x: FIRST_COLUMN_X,
      y: FIRST_INITIATIVE_Y - 30,
      width: 300,
      height: 22,
      text: "Initiatives",
      fontSize: 16,
    },
    {
      kind: "text",
      id: "footer",
      x: FIRST_COLUMN_X,
      y: FIRST_INITIATIVE_Y + 2 * (INITIATIVE_HEIGHT + INITIATIVE_GAP) + 16,
      width: 700,
      height: 20,
      text: "Owner: Alex · Confidence: 7/10 · Check-in: every Friday",
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
