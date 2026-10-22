import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The six thinking hats: the same problem seen from six angles, each hat
 * asking for a different kind of thinking.
 *
 * The hats are laid out in the order they are usually worn — facts, then
 * feelings, then caution, then benefit, then possibility, then process.
 */

const PANEL_WIDTH = 300;
const PANEL_HEIGHT = 200;
const COLUMN_GAP = 20;
const ROW_GAP = 24;
const FIRST_PANEL_X = 40;
const FIRST_PANEL_Y = 120;

const HATS: PanelBlock[] = [
  {
    id: "white",
    title: "White hat — facts",
    x: FIRST_PANEL_X,
    y: FIRST_PANEL_Y,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: [
      "Only what we know for certain",
      "What is true today?",
      "What are the hard numbers?",
    ],
  },
  {
    id: "red",
    title: "Red hat — feelings",
    x: FIRST_PANEL_X + PANEL_WIDTH + COLUMN_GAP,
    y: FIRST_PANEL_Y,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    items: [
      "Instinct, gut, emotion",
      "How does this feel to us?",
      "What is our first reaction?",
    ],
  },
  {
    id: "black",
    title: "Black hat — caution",
    x: FIRST_PANEL_X + (PANEL_WIDTH + COLUMN_GAP) * 2,
    y: FIRST_PANEL_Y,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: COLOR_PALETTE.gray[1],
    stroke: COLOR_PALETTE.gray[4],
    items: [
      "Careful, critical thinking",
      "What could go wrong?",
      "What is the worst case?",
    ],
  },
  {
    id: "yellow",
    title: "Yellow hat — benefits",
    x: FIRST_PANEL_X,
    y: FIRST_PANEL_Y + PANEL_HEIGHT + ROW_GAP,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    items: [
      "Optimistic, constructive",
      "What is good about this?",
      "What do we gain by doing it?",
    ],
  },
  {
    id: "green",
    title: "Green hat — ideas",
    x: FIRST_PANEL_X + PANEL_WIDTH + COLUMN_GAP,
    y: FIRST_PANEL_Y + PANEL_HEIGHT + ROW_GAP,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: [
      "Possibility, creativity",
      "What else could we do?",
      "What is the wildest idea?",
    ],
  },
  {
    id: "blue",
    title: "Blue hat — process",
    x: FIRST_PANEL_X + (PANEL_WIDTH + COLUMN_GAP) * 2,
    y: FIRST_PANEL_Y + PANEL_HEIGHT + ROW_GAP,
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: [
      "Where do we stand?",
      "What is the next step?",
      "Who does what, and by when?",
    ],
  },
];

export const sixThinkingHatsTemplate: ExcalidrawTemplate = {
  id: "six-thinking-hats",
  nameKey: "labels.templates.items.sixThinkingHats.name",
  descriptionKey: "labels.templates.items.sixThinkingHats.description",
  category: "ideation",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Six Thinking Hats",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "One problem, six points of view. Take a hat at a time and write only in that hat.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...HATS.flatMap(panelElements),
  ],
};
