import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The business model canvas: the nine blocks every business model is drawn
 * with — who we serve, what we promise them, how we deliver it, and how the
 * money works.
 *
 * The blocks come with the questions a canvas asks, so the board starts as a
 * set of prompts rather than as an empty grid.
 */

const BLOCKS: PanelBlock[] = [
  {
    id: "key-partners",
    title: "Key Partners",
    x: 40,
    y: 110,
    width: 215,
    height: 350,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    items: [
      "Who do we depend on?",
      "Co-founders and investors",
      "Cloud and hosting vendors",
      "Distribution partners",
    ],
  },
  {
    id: "key-activities",
    title: "Key Activities",
    x: 265,
    y: 110,
    width: 215,
    height: 180,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: ["Product development", "Customer support", "Sales and marketing"],
  },
  {
    id: "value-propositions",
    title: "Value Propositions",
    x: 490,
    y: 110,
    width: 235,
    height: 350,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: [
      "What do customers get?",
      "One board for every team",
      "Templates that start you off",
      "No installation, no setup",
    ],
  },
  {
    id: "customer-relationships",
    title: "Customer Relationships",
    x: 735,
    y: 110,
    width: 215,
    height: 180,
    background: COLOR_PALETTE.violet[0],
    stroke: COLOR_PALETTE.violet[2],
    items: ["Self-serve onboarding", "Community and templates"],
  },
  {
    id: "customer-segments",
    title: "Customer Segments",
    x: 960,
    y: 110,
    width: 215,
    height: 350,
    background: COLOR_PALETTE.pink[0],
    stroke: COLOR_PALETTE.pink[2],
    items: [
      "Who do we serve?",
      "Startups of 5–50 people",
      "Remote design teams",
      "Agencies and consultancies",
    ],
  },
  {
    id: "key-resources",
    title: "Key Resources",
    x: 265,
    y: 300,
    width: 215,
    height: 160,
    background: COLOR_PALETTE.cyan[0],
    stroke: COLOR_PALETTE.cyan[2],
    items: ["The engineering team", "The brand and the code"],
  },
  {
    id: "channels",
    title: "Channels",
    x: 735,
    y: 300,
    width: 215,
    height: 160,
    background: COLOR_PALETTE.teal[0],
    stroke: COLOR_PALETTE.teal[2],
    items: ["Product-led growth", "Marketplace listing"],
  },
  {
    id: "cost-structure",
    title: "Cost Structure",
    x: 40,
    y: 480,
    width: 580,
    height: 170,
    background: COLOR_PALETTE.orange[0],
    stroke: COLOR_PALETTE.orange[2],
    items: [
      "What does it cost to run?",
      "Cloud hosting and storage",
      "Salaries and contractors",
      "Marketing and sales spend",
    ],
  },
  {
    id: "revenue-streams",
    title: "Revenue Streams",
    x: 640,
    y: 480,
    width: 535,
    height: 170,
    background: COLOR_PALETTE.grape[0],
    stroke: COLOR_PALETTE.grape[2],
    items: [
      "How do we earn?",
      "Free tier, paid team plan",
      "Enterprise contract",
    ],
  },
];

export const businessModelCanvasTemplate: ExcalidrawTemplate = {
  id: "business-model-canvas",
  nameKey: "labels.templates.items.businessModelCanvas.name",
  descriptionKey: "labels.templates.items.businessModelCanvas.description",
  category: "business",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Business Model Canvas",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Fill in the nine blocks, then read them across: what we do, for whom, and how it pays for itself.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...BLOCKS.flatMap(panelElements),
  ],
};
