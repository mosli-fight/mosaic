import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";

/**
 * The dot voting board: the ideas a session came up with, each one waiting
 * for the votes that say it is worth doing.
 */

const CARD_WIDTH = 280;
const CARD_HEIGHT = 140;
const COLUMN_GAP = 30;
const ROW_GAP = 30;
const FIRST_CARD_X = 40;
const FIRST_CARD_Y = 120;

const DOT_SIZE = 18;
const DOT_GAP = 8;

const IDEAS = [
  { idea: "A shared library of templates", votes: 4 },
  { idea: "Templates that fill themselves in", votes: 3 },
  { idea: "One-click sharing for a whole team", votes: 2 },
  { idea: "Version history on every board", votes: 5 },
  { idea: "A template for every team", votes: 1 },
  { idea: "A canvas that feels instant", votes: 3 },
];

const cardElements = (
  entry: typeof IDEAS[number],
  index: number,
): TemplateElementSpec[] => {
  const column = index % 3;
  const row = Math.floor(index / 3);
  const x = FIRST_CARD_X + column * (CARD_WIDTH + COLUMN_GAP);
  const y = FIRST_CARD_Y + row * (CARD_HEIGHT + ROW_GAP);

  const dots: TemplateElementSpec[] = Array.from(
    { length: entry.votes },
    (_, dot) => ({
      kind: "ellipse",
      id: `vote-${index + 1}-${dot + 1}`,
      x: x + 16 + dot * (DOT_SIZE + DOT_GAP),
      y: y + CARD_HEIGHT - DOT_SIZE - 16,
      width: DOT_SIZE,
      height: DOT_SIZE,
      backgroundColor: COLOR_PALETTE.blue[3],
      strokeColor: COLOR_PALETTE.blue[4],
    }),
  );

  return [
    {
      kind: "rectangle",
      id: `idea-${index + 1}`,
      x,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      label: entry.idea,
      fontSize: 15,
      textAlign: "left",
      verticalAlign: "top",
      backgroundColor: COLOR_PALETTE.white,
      strokeColor: COLOR_PALETTE.gray[2],
      roundness: true,
    },
    ...dots,
    {
      kind: "text",
      id: `count-${index + 1}`,
      x: x + CARD_WIDTH - 70,
      y: y + CARD_HEIGHT - DOT_SIZE - 17,
      width: 54,
      height: 20,
      text: `${entry.votes} votes`,
      fontSize: 13,
      align: "right",
      color: COLOR_PALETTE.gray[4],
    },
  ];
};

export const dotVotingBoardTemplate: ExcalidrawTemplate = {
  id: "dot-voting-board",
  nameKey: "labels.templates.items.dotVotingBoard.name",
  descriptionKey: "labels.templates.items.dotVotingBoard.description",
  category: "ideation",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Dot Voting",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Every voter has three dots. Drop them on the ideas you would fund, then count.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...IDEAS.flatMap(cardElements),
  ],
};
