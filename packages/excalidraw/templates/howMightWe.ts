import { COLOR_PALETTE } from "@excalidraw/common";

import type { StickyNoteHueName } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The "how might we" board: one problem at the top, three questions in the
 * middle, and the ideas that answer them below.
 */

const PROBLEM_WIDTH = 1000;
const PROBLEM_HEIGHT = 92;

const COLUMN_WIDTH = 320;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;
const PROMPT_Y = 220;
const PROMPT_HEIGHT = 84;

const NOTE_WIDTH = 300;
const NOTE_HEIGHT = 100;
const NOTE_GAP = 18;
const FIRST_NOTE_Y = 324;

const PROBLEM: PanelBlock = {
  id: "problem",
  title: "The problem",
  x: FIRST_COLUMN_X,
  y: 100,
  width: PROBLEM_WIDTH,
  height: PROBLEM_HEIGHT,
  background: COLOR_PALETTE.red[0],
  stroke: COLOR_PALETTE.red[2],
  items: [
    "People lose the context of a decision when it is shared as a link to a board",
  ],
};

const COLUMNS: (PanelBlock & { hue: StickyNoteHueName; notes: string[] })[] = [
  {
    id: "first-board",
    title: "How might we…",
    hue: "yellow",
    x: FIRST_COLUMN_X,
    y: PROMPT_Y,
    width: COLUMN_WIDTH,
    height: PROMPT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["make the first board feel effortless?"],
    notes: ["Start from a template", "A one-minute tour"],
  },
  {
    id: "context",
    title: "How might we…",
    hue: "blue",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: PROMPT_Y,
    width: COLUMN_WIDTH,
    height: PROMPT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["keep the context where the work happens?"],
    notes: ["Decisions on the board", "A short note with every link"],
  },
  {
    id: "invite",
    title: "How might we…",
    hue: "green",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: PROMPT_Y,
    width: COLUMN_WIDTH,
    height: PROMPT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["invite a team in without a tutorial?"],
    notes: ["Invite by email", "A shared starter board"],
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

export const howMightWeTemplate: ExcalidrawTemplate = {
  id: "how-might-we",
  nameKey: "labels.templates.items.howMightWe.name",
  descriptionKey: "labels.templates.items.howMightWe.description",
  category: "ideation",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "How Might We",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Name the problem, ask three questions about it, then answer them with ideas.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...panelElements(PROBLEM),
    ...COLUMNS.flatMap(columnElements),
  ],
};
