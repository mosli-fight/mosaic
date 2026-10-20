import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The retro board: what went well, what didn't, and what we are going to do
 * about it — the three columns every retrospective ends with.
 */

const COLUMN_WIDTH = 250;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;
const COLUMN_Y = 100;
const COLUMN_HEIGHT = 380;

const COLUMNS = [
  {
    id: "well",
    title: "What went well",
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    notes: ["Keep doing this", "It helped us ship"],
  },
  {
    id: "badly",
    title: "What didn't go well",
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    notes: ["Too many handoffs", "Unclear ownership"],
  },
  {
    id: "actions",
    title: "Action items",
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    notes: ["Write it down", "Who owns it?"],
  },
];

const NOTE_WIDTH = 200;
const NOTE_HEIGHT = 110;
const NOTE_GAP = 20;

export const retroBoardTemplate: ExcalidrawTemplate = {
  id: "retro-board",
  nameKey: "labels.templates.items.retroBoard.name",
  descriptionKey: "labels.templates.items.retroBoard.description",
  category: "agile",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Retrospective",
      fontSize: 32,
    },
    ...COLUMNS.flatMap((column, columnIndex) => [
      {
        kind: "rectangle" as const,
        id: `${column.id}-column`,
        x: FIRST_COLUMN_X + columnIndex * (COLUMN_WIDTH + COLUMN_GAP),
        y: COLUMN_Y,
        width: COLUMN_WIDTH,
        height: COLUMN_HEIGHT,
        label: column.title,
        fontSize: 18,
        verticalAlign: "top" as const,
        backgroundColor: column.background,
        strokeColor: column.stroke,
        roundness: true,
      },
      ...column.notes.map((note, index) => ({
        kind: "sticky" as const,
        id: `${column.id}-note-${index + 1}`,
        x:
          FIRST_COLUMN_X +
          columnIndex * (COLUMN_WIDTH + COLUMN_GAP) +
          (COLUMN_WIDTH - NOTE_WIDTH) / 2,
        y: COLUMN_Y + 70 + index * (NOTE_HEIGHT + NOTE_GAP),
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        text: note,
        fontSize: 15,
        hue: "yellow" as const,
      })),
    ]),
  ],
};
