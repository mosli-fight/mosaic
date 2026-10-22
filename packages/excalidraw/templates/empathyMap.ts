import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The empathy map: one person, seen from four sides — what they say, what
 * they think, what they do, and what they feel.
 */

const QUADRANT_WIDTH = 320;
const QUADRANT_HEIGHT = 180;
const TOP_Y = 110;
const BOTTOM_Y = 450;

const USER_WIDTH = 220;
const USER_HEIGHT = 140;
const USER_X = 390;
const USER_Y = 300;

const QUADRANTS: PanelBlock[] = [
  {
    id: "says",
    title: "Says",
    x: 40,
    y: TOP_Y,
    width: QUADRANT_WIDTH,
    height: QUADRANT_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: [
      "“We keep losing track of who decided what.”",
      "“Can you send me that board again?”",
    ],
  },
  {
    id: "thinks",
    title: "Thinks",
    x: 640,
    y: TOP_Y,
    width: QUADRANT_WIDTH,
    height: QUADRANT_HEIGHT,
    background: COLOR_PALETTE.violet[0],
    stroke: COLOR_PALETTE.violet[2],
    items: [
      "“Nobody reads a whole board.”",
      "“I should not have to ask twice.”",
    ],
  },
  {
    id: "does",
    title: "Does",
    x: 40,
    y: BOTTOM_Y,
    width: QUADRANT_WIDTH,
    height: QUADRANT_HEIGHT,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: [
      "Forwards links in the team chat",
      "Screenshots a board to share it",
    ],
  },
  {
    id: "feels",
    title: "Feels",
    x: 640,
    y: BOTTOM_Y,
    width: QUADRANT_WIDTH,
    height: QUADRANT_HEIGHT,
    background: COLOR_PALETTE.orange[0],
    stroke: COLOR_PALETTE.orange[2],
    items: ["Overwhelmed by too many boards", "Guilty about the mess"],
  },
];

export const empathyMapTemplate: ExcalidrawTemplate = {
  id: "empathy-map",
  nameKey: "labels.templates.items.empathyMap.name",
  descriptionKey: "labels.templates.items.empathyMap.description",
  category: "research",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Empathy Map",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Fill it in with real words from real people — interviews, support tickets, a hallway.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...QUADRANTS.flatMap(panelElements),
    {
      kind: "ellipse",
      id: "user",
      x: USER_X,
      y: USER_Y,
      width: USER_WIDTH,
      height: USER_HEIGHT,
      label: "Our user",
      fontSize: 18,
      backgroundColor: COLOR_PALETTE.yellow[0],
      strokeColor: COLOR_PALETTE.yellow[3],
    },
    {
      kind: "text",
      id: "user-detail",
      x: USER_X,
      y: USER_Y + USER_HEIGHT + 14,
      width: USER_WIDTH,
      height: 20,
      text: "Maya — leads a team of six",
      fontSize: 15,
      align: "center",
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
