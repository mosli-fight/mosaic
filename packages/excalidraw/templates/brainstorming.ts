import { COLOR_PALETTE } from "@excalidraw/common";

import type { StickyNoteHueName } from "@excalidraw/common";

import type { ExcalidrawTemplate, TemplateStickySpec } from "./types";

/**
 * The brainstorming board: a title and a grid of empty notes to fill in.
 *
 * The notes are laid out in a grid rather than scattered, because a grid is
 * what makes a brainstorm read as a set of options rather than as a mess.
 */

const NOTE_WIDTH = 180;
const NOTE_HEIGHT = 130;
const GAP = 20;
const COLUMNS = 4;
const ROWS = 3;

const HUES: StickyNoteHueName[] = [
  "yellow",
  "blue",
  "green",
  "orange",
  "violet",
  "pink",
  "cyan",
  "red",
];

const notes: TemplateStickySpec[] = Array.from(
  { length: COLUMNS * ROWS },
  (_, index) => {
    const column = index % COLUMNS;
    const row = Math.floor(index / COLUMNS);

    return {
      kind: "sticky",
      id: `note-${index + 1}`,
      x: 40 + column * (NOTE_WIDTH + GAP),
      y: 100 + row * (NOTE_HEIGHT + GAP),
      width: NOTE_WIDTH,
      height: NOTE_HEIGHT,
      hue: HUES[index % HUES.length],
      text: `Idea ${index + 1}`,
    };
  },
);

export const brainstormingTemplate: ExcalidrawTemplate = {
  id: "brainstorming",
  nameKey: "labels.templates.items.brainstorming.name",
  descriptionKey: "labels.templates.items.brainstorming.description",
  category: "ideation",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Brainstorming",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 64,
      width: 700,
      height: 24,
      text: "One idea per note — write them all down before you judge them.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...notes,
  ],
};
