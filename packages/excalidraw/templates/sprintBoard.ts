import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The sprint board: the sprint's goal at the top, and the work under it in
 * the four columns it moves through.
 */

const COLUMN_WIDTH = 240;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;

const HEADER_Y = 200;
const HEADER_HEIGHT = 46;

const CARD_WIDTH = 220;
const CARD_HEIGHT = 84;
const CARD_GAP = 12;
const FIRST_CARD_Y = 260;

const GOAL: PanelBlock = {
  id: "sprint-goal",
  title: "Sprint goal",
  x: FIRST_COLUMN_X,
  y: 100,
  width: COLUMN_WIDTH * 4 + COLUMN_GAP * 3,
  height: 74,
  background: COLOR_PALETTE.blue[0],
  stroke: COLOR_PALETTE.blue[2],
  items: ["Ship the template gallery to every team — Sprint 14, two weeks"],
};

const COLUMNS: (PanelBlock & { cards: { text: string; meta: string }[] })[] = [
  {
    id: "to-do",
    title: "To do",
    x: FIRST_COLUMN_X,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.gray[1],
    stroke: COLOR_PALETTE.gray[3],
    cards: [
      { text: "Write the empty-state copy", meta: "3 points · Priya" },
      { text: "Add a filter to the gallery", meta: "5 points · Sam" },
      { text: "Fix the preview on dark", meta: "2 points · Lena" },
    ],
  },
  {
    id: "in-progress",
    title: "In progress",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
    cards: [
      { text: "Move the catalogue to its own chunk", meta: "8 points · Sam" },
      { text: "Show a line while it loads", meta: "3 points · Alex" },
    ],
  },
  {
    id: "in-review",
    title: "In review",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.violet[1],
    stroke: COLOR_PALETTE.violet[3],
    cards: [
      { text: "The template preview on a phone", meta: "5 points · Dana" },
    ],
  },
  {
    id: "done",
    title: "Done",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 3,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.green[1],
    stroke: COLOR_PALETTE.green[3],
    cards: [
      { text: "Split the sticker catalogue out", meta: "5 points · Sam" },
      { text: "Open the gallery from the menu", meta: "2 points · Priya" },
    ],
  },
];

const columnElements = (
  column: typeof COLUMNS[number],
): TemplateElementSpec[] => [
  ...panelElements({
    id: column.id,
    title: column.title,
    x: column.x,
    y: column.y,
    width: column.width,
    height: column.height,
    background: column.background,
    stroke: column.stroke,
    titleAlign: "center",
    titleVerticalAlign: "middle",
  }),
  {
    kind: "text",
    id: `${column.id}-count`,
    x: column.x + column.width - 40,
    y: column.y + 13,
    width: 28,
    height: 20,
    text: `${column.cards.length}`,
    fontSize: 15,
    align: "right",
    color: COLOR_PALETTE.gray[4],
  },
  ...column.cards.flatMap((card, index) =>
    panelElements({
      id: `${column.id}-card-${index + 1}`,
      title: card.text,
      x: column.x + 10,
      y: FIRST_CARD_Y + index * (CARD_HEIGHT + CARD_GAP),
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      titleFontSize: 14,
      titleHeight: 46,
      background: COLOR_PALETTE.white,
      stroke: COLOR_PALETTE.gray[2],
      items: [card.meta],
    }),
  ),
];

export const sprintBoardTemplate: ExcalidrawTemplate = {
  id: "sprint-board",
  nameKey: "labels.templates.items.sprintBoard.name",
  descriptionKey: "labels.templates.items.sprintBoard.description",
  category: "agile",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Sprint Board",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "One goal for the sprint, then the work under it. Move a card as it travels.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...panelElements(GOAL),
    ...COLUMNS.flatMap(columnElements),
    {
      kind: "text",
      id: "summary",
      x: FIRST_COLUMN_X,
      y: FIRST_CARD_Y + 3 * (CARD_HEIGHT + CARD_GAP) + 12,
      width: 600,
      height: 20,
      text: "Committed 34 points · Done 13 · In progress 8 · Left to pick 5",
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
