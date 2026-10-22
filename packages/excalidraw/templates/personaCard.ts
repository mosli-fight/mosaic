import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The persona card: one person, written down so that a team can argue about
 * the same person rather than about different ones.
 *
 * The card sits on a frame, so it reads as a page that can be copied for
 * every persona in a study.
 */

const FRAME_ID = "page";

const PHOTO_WIDTH = 180;
const PHOTO_HEIGHT = 180;

const PANELS: PanelBlock[] = [
  {
    id: "goals",
    title: "Goals",
    x: 60,
    y: 290,
    width: 240,
    height: 160,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: ["Ship the quarterly plan", "Keep the team unblocked"],
  },
  {
    id: "frustrations",
    title: "Frustrations",
    x: 320,
    y: 290,
    width: 240,
    height: 160,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    items: ["Decisions are scattered", "Nobody knows the owner"],
  },
  {
    id: "bio",
    title: "About",
    x: 580,
    y: 290,
    width: 240,
    height: 160,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Six years in product", "Remote, four time zones"],
  },
  {
    id: "tools",
    title: "Tools they use",
    x: 60,
    y: 470,
    width: 340,
    height: 160,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: ["Chat, spreadsheets", "One very old slide deck"],
  },
  {
    id: "quotes",
    title: "In their own words",
    x: 440,
    y: 470,
    width: 380,
    height: 160,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    items: ["“I just want one place where the answer is.”"],
  },
];

export const personaCardTemplate: ExcalidrawTemplate = {
  id: "persona-card",
  nameKey: "labels.templates.items.personaCard.name",
  descriptionKey: "labels.templates.items.personaCard.description",
  category: "research",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Persona Card",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Copy the card once per persona, and keep every claim traceable to something a real person said.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "frame",
      id: FRAME_ID,
      x: 40,
      y: 100,
      width: 800,
      height: 560,
      name: "Persona",
      fill: COLOR_PALETTE.white,
    },
    {
      kind: "rectangle",
      id: "photo",
      x: 60,
      y: 120,
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      inFrame: FRAME_ID,
      label: "Photo",
      fontSize: 15,
      backgroundColor: COLOR_PALETTE.gray[0],
      strokeColor: COLOR_PALETTE.gray[3],
    },
    {
      kind: "text",
      id: "name",
      x: 260,
      y: 126,
      width: 400,
      height: 34,
      inFrame: FRAME_ID,
      text: "Maya Chen",
      fontSize: 26,
    },
    {
      kind: "text",
      id: "role",
      x: 260,
      y: 168,
      width: 400,
      height: 22,
      inFrame: FRAME_ID,
      text: "Team lead · 6 people · Berlin",
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "quote",
      x: 260,
      y: 202,
      width: 540,
      height: 60,
      inFrame: FRAME_ID,
      text: "“Every week I rebuild the same picture in three different tools, and then I argue about which one is right.”",
      fontSize: 15,
    },
    ...PANELS.flatMap((panel) =>
      panelElements(panel).map((element) => ({
        ...element,
        inFrame: FRAME_ID,
      })),
    ),
  ],
};
