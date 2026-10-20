import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The user journey map: the stages a person goes through, and under each
 * stage what they do, what they feel, and what they run into.
 */

const STAGE_WIDTH = 160;
const STAGE_GAP = 12;
const FIRST_STAGE_X = 150;
const HEADER_Y = 100;
const ROW_HEIGHT = 130;
const ROW_GAP = 20;

const STAGES = [
  { id: "awareness", title: "Awareness" },
  { id: "consideration", title: "Consideration" },
  { id: "purchase", title: "Purchase" },
  { id: "retention", title: "Retention" },
  { id: "advocacy", title: "Advocacy" },
];

const ROWS = [
  {
    id: "touchpoints",
    title: "Touchpoints",
    y: HEADER_Y + 60,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    texts: [
      "Sees an ad",
      "Reads a review",
      "Asks support",
      "Gets an email",
      "Shares it",
    ],
  },
  {
    id: "emotions",
    title: "Emotions",
    y: HEADER_Y + 60 + ROW_HEIGHT + ROW_GAP,
    background: COLOR_PALETTE.yellow[0],
    stroke: COLOR_PALETTE.yellow[2],
    texts: ["Curious", "Uncertain", "Relieved", "Loyal", "Delighted"],
  },
];

const stageX = (index: number) =>
  FIRST_STAGE_X + index * (STAGE_WIDTH + STAGE_GAP);

export const userJourneyMapTemplate: ExcalidrawTemplate = {
  id: "user-journey-map",
  nameKey: "labels.templates.items.userJourneyMap.name",
  descriptionKey: "labels.templates.items.userJourneyMap.description",
  category: "research",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "User Journey Map",
      fontSize: 32,
    },
    ...STAGES.map((stage, index) => ({
      kind: "rectangle" as const,
      id: `${stage.id}-header`,
      x: stageX(index),
      y: HEADER_Y,
      width: STAGE_WIDTH,
      height: 44,
      label: stage.title,
      fontSize: 15,
      backgroundColor: COLOR_PALETTE.gray[1],
      strokeColor: COLOR_PALETTE.gray[3],
      roundness: true,
    })),
    ...ROWS.flatMap((row) => [
      {
        kind: "text" as const,
        id: `${row.id}-label`,
        x: 20,
        y: row.y + 50,
        width: 120,
        height: 24,
        text: row.title,
        fontSize: 16,
        align: "right" as const,
      },
      ...STAGES.map((stage, index) => ({
        kind: "rectangle" as const,
        id: `${stage.id}-${row.id}`,
        x: stageX(index),
        y: row.y,
        width: STAGE_WIDTH,
        height: ROW_HEIGHT,
        label: row.texts[index],
        fontSize: 14,
        backgroundColor: row.background,
        strokeColor: row.stroke,
        roundness: true,
      })),
    ]),
    {
      kind: "arrow",
      id: "time",
      x: FIRST_STAGE_X,
      y: HEADER_Y + 60 + ROW_HEIGHT * 2 + ROW_GAP + 40,
      dx: STAGE_WIDTH * STAGES.length + STAGE_GAP * (STAGES.length - 1),
      dy: 0,
      strokeColor: COLOR_PALETTE.gray[4],
      strokeWidth: 2,
    },
    {
      kind: "text",
      id: "time-label",
      x: FIRST_STAGE_X,
      y: HEADER_Y + 60 + ROW_HEIGHT * 2 + ROW_GAP + 10,
      width: 200,
      height: 24,
      text: "Time",
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
