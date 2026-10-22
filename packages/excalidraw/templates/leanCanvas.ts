import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The lean canvas: the same questions as the business model canvas, asked in
 * the order a new venture asks them — the problem first, the solution last.
 */

const BLOCKS: PanelBlock[] = [
  {
    id: "problem",
    title: "Problem",
    x: 40,
    y: 110,
    width: 225,
    height: 190,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    items: [
      "What hurts?",
      "The pain the customer feels",
      "What is slow, costly or missing",
    ],
  },
  {
    id: "solution",
    title: "Solution",
    x: 275,
    y: 110,
    width: 225,
    height: 190,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: [
      "What takes its place?",
      "One board for every team",
      "Templates that start you off",
    ],
  },
  {
    id: "key-metrics",
    title: "Key Metrics",
    x: 510,
    y: 110,
    width: 225,
    height: 190,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: [
      "How do we know it works?",
      "Time to first board",
      "Weekly active teams",
    ],
  },
  {
    id: "unfair-advantage",
    title: "Unfair Advantage",
    x: 745,
    y: 110,
    width: 225,
    height: 190,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    items: [
      "What cannot be copied?",
      "The template library",
      "Years of research",
    ],
  },
  {
    id: "customer-segments",
    title: "Customer Segments",
    x: 40,
    y: 310,
    width: 225,
    height: 190,
    background: COLOR_PALETTE.pink[0],
    stroke: COLOR_PALETTE.pink[2],
    items: [
      "Who has the problem?",
      "Startups of 5–50 people",
      "Remote design teams",
    ],
  },
  {
    id: "high-level-concept",
    title: "High-Level Concept",
    x: 275,
    y: 310,
    width: 460,
    height: 190,
    background: COLOR_PALETTE.violet[0],
    stroke: COLOR_PALETTE.violet[2],
    items: [
      "The product in one picture",
      "Draw the core screen here",
      "Who it serves, and why it wins",
    ],
  },
  {
    id: "channels",
    title: "Channels",
    x: 745,
    y: 310,
    width: 225,
    height: 190,
    background: COLOR_PALETTE.cyan[0],
    stroke: COLOR_PALETTE.cyan[2],
    items: [
      "How do they find us?",
      "Product-led growth",
      "Marketplace listing",
    ],
  },
  {
    id: "cost-structure",
    title: "Cost Structure",
    x: 40,
    y: 510,
    width: 460,
    height: 160,
    background: COLOR_PALETTE.orange[0],
    stroke: COLOR_PALETTE.orange[2],
    items: [
      "What does it cost to deliver?",
      "Hosting and storage",
      "Salaries and support",
    ],
  },
  {
    id: "revenue-streams",
    title: "Revenue Streams",
    x: 510,
    y: 510,
    width: 460,
    height: 160,
    background: COLOR_PALETTE.grape[0],
    stroke: COLOR_PALETTE.grape[2],
    items: ["What do we earn?", "Free tier, team plan, enterprise"],
  },
];

export const leanCanvasTemplate: ExcalidrawTemplate = {
  id: "lean-canvas",
  nameKey: "labels.templates.items.leanCanvas.name",
  descriptionKey: "labels.templates.items.leanCanvas.description",
  category: "business",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Lean Canvas",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Nine blocks, filled in the order a new venture meets them: problem, solution, then the rest.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...BLOCKS.flatMap(panelElements),
  ],
};
