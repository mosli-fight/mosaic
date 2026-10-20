import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The mind map starter: one topic in the middle and four branches around
 * it, each branch a box to expand into.
 */

const CENTER_X = 380;
const CENTER_Y = 240;

const BRANCHES = [
  {
    id: "why",
    title: "Why?",
    x: 60,
    y: 100,
    background: COLOR_PALETTE.yellow[1],
    stroke: COLOR_PALETTE.yellow[3],
  },
  {
    id: "who",
    title: "Who?",
    x: 640,
    y: 100,
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
  },
  {
    id: "how",
    title: "How?",
    x: 60,
    y: 380,
    background: COLOR_PALETTE.green[1],
    stroke: COLOR_PALETTE.green[3],
  },
  {
    id: "what",
    title: "What?",
    x: 640,
    y: 380,
    background: COLOR_PALETTE.pink[1],
    stroke: COLOR_PALETTE.pink[3],
  },
];

export const mindMapTemplate: ExcalidrawTemplate = {
  id: "mind-map",
  nameKey: "labels.templates.items.mindMap.name",
  descriptionKey: "labels.templates.items.mindMap.description",
  category: "ideation",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Mind Map",
      fontSize: 32,
    },
    {
      kind: "ellipse",
      id: "center",
      x: CENTER_X,
      y: CENTER_Y,
      width: 180,
      height: 100,
      label: "Central topic",
      fontSize: 18,
      backgroundColor: COLOR_PALETTE.violet[1],
      strokeColor: COLOR_PALETTE.violet[3],
    },
    ...BRANCHES.flatMap((branch) => {
      const branchCenterX = branch.x + 100;
      const branchCenterY = branch.y + 40;

      return [
        {
          kind: "rectangle" as const,
          id: `${branch.id}-box`,
          x: branch.x,
          y: branch.y,
          width: 200,
          height: 80,
          label: branch.title,
          fontSize: 18,
          backgroundColor: branch.background,
          strokeColor: branch.stroke,
          roundness: true,
        },
        {
          kind: "arrow" as const,
          id: `${branch.id}-link`,
          x: CENTER_X + 90,
          y: CENTER_Y + 50,
          dx: branchCenterX - (CENTER_X + 90),
          dy: branchCenterY - (CENTER_Y + 50),
          strokeColor: COLOR_PALETTE.gray[3],
          strokeWidth: 2,
        },
      ];
    }),
  ],
};
