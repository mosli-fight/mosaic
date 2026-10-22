import { COLOR_PALETTE } from "@excalidraw/common";

import type { StickyNoteHueName } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The start / stop / continue retrospective: three columns, each asking one
 * question, each holding the notes that answer it.
 */

const COLUMN_WIDTH = 300;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;
const HEADER_Y = 110;
const HEADER_HEIGHT = 90;

const NOTE_WIDTH = 280;
const NOTE_HEIGHT = 110;
const NOTE_GAP = 16;
const FIRST_NOTE_Y = 220;

const COLUMNS: (PanelBlock & { hue: StickyNoteHueName; notes: string[] })[] = [
  {
    id: "start",
    title: "Start",
    hue: "green",
    x: FIRST_COLUMN_X,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: ["What should we begin doing?"],
    notes: ["Pair on the hard parts", "A demo every Friday"],
  },
  {
    id: "stop",
    title: "Stop",
    hue: "red",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    items: ["What should we end doing?"],
    notes: ["Meetings without an agenda", "Skipping the retrospective"],
  },
  {
    id: "continue",
    title: "Continue",
    hue: "blue",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: ["What is already working?"],
    notes: ["Small releases", "Written decisions"],
  },
];

const columnElements = (
  column: typeof COLUMNS[number],
): TemplateElementSpec[] => {
  const notes: TemplateElementSpec[] = column.notes.map((note, index) => ({
    kind: "sticky",
    id: `${column.id}-note-${index + 1}`,
    x: column.x + (COLUMN_WIDTH - NOTE_WIDTH) / 2,
    y: FIRST_NOTE_Y + index * (NOTE_HEIGHT + NOTE_GAP),
    width: NOTE_WIDTH,
    height: NOTE_HEIGHT,
    text: note,
    fontSize: 16,
    hue: column.hue,
  }));

  return [...panelElements(column), ...notes];
};

export const startStopContinueTemplate: ExcalidrawTemplate = {
  id: "start-stop-continue",
  nameKey: "labels.templates.items.startStopContinue.name",
  descriptionKey: "labels.templates.items.startStopContinue.description",
  category: "meetings",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Start · Stop · Continue",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "One question per column. Add a note to each, then pick one change to make.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...COLUMNS.flatMap(columnElements),
  ],
};
