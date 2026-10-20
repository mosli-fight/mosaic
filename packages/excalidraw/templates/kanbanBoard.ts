import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The Kanban board: four columns of work, each with a header and a stack of
 * cards, so that a board can be started by dropping work into it.
 */

const COLUMN_WIDTH = 210;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;

const CARD_HEIGHT = 84;
const FIRST_CARD_Y = 160;
const CARD_GAP = 16;

type Column = {
  id: string;
  title: string;
  background: string;
  stroke: string;
  cards: string[];
};

const COLUMNS: Column[] = [
  {
    id: "todo",
    title: "To Do",
    background: COLOR_PALETTE.gray[1],
    stroke: COLOR_PALETTE.gray[3],
    cards: ["Write the brief", "Collect references"],
  },
  {
    id: "progress",
    title: "In Progress",
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
    cards: ["Draft the concept", "Build the prototype"],
  },
  {
    id: "review",
    title: "In Review",
    background: COLOR_PALETTE.violet[1],
    stroke: COLOR_PALETTE.violet[3],
    cards: ["Review pass", "Accessibility check"],
  },
  {
    id: "done",
    title: "Done",
    background: COLOR_PALETTE.green[1],
    stroke: COLOR_PALETTE.green[3],
    cards: ["User research", "Interviews"],
  },
];

const columnX = (index: number) =>
  FIRST_COLUMN_X + index * (COLUMN_WIDTH + COLUMN_GAP);

export const kanbanBoardTemplate: ExcalidrawTemplate = {
  id: "kanban-board",
  nameKey: "labels.templates.items.kanbanBoard.name",
  descriptionKey: "labels.templates.items.kanbanBoard.description",
  category: "agile",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Kanban Board",
      fontSize: 32,
    },
    ...COLUMNS.flatMap((column, columnIndex) => [
      {
        kind: "rectangle" as const,
        id: `${column.id}-header`,
        x: columnX(columnIndex),
        y: 92,
        width: COLUMN_WIDTH,
        height: 48,
        label: column.title,
        fontSize: 18,
        backgroundColor: column.background,
        strokeColor: column.stroke,
        roundness: true,
      },
      ...column.cards.map((card, cardIndex) => ({
        kind: "rectangle" as const,
        id: `${column.id}-card-${cardIndex + 1}`,
        x: columnX(columnIndex),
        y: FIRST_CARD_Y + cardIndex * (CARD_HEIGHT + CARD_GAP),
        width: COLUMN_WIDTH,
        height: CARD_HEIGHT,
        label: card,
        fontSize: 16,
        textAlign: "left" as const,
        verticalAlign: "top" as const,
        backgroundColor: COLOR_PALETTE.white,
        strokeColor: COLOR_PALETTE.gray[2],
        roundness: true,
      })),
    ]),
  ],
};
