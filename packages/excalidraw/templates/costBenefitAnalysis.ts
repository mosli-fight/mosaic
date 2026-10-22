import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";

/**
 * The cost-benefit analysis: what a proposal costs on one side, what it
 * brings on the other, and what the difference adds up to.
 *
 * The two lists are lined up row by row, so the eye can travel from a cost
 * to the benefit that answers it.
 */

const COLUMN_WIDTH = 440;
const COLUMN_GAP = 40;
const FIRST_COLUMN_X = 40;

const HEADER_Y = 110;
const HEADER_HEIGHT = 44;

const ROW_HEIGHT = 66;
const FIRST_ROW_Y = 170;
const ROWS = 5;

const COSTS = [
  { item: "Cloud hosting and storage", amount: "$1,200 / month" },
  { item: "Engineering time (6 weeks)", amount: "$18,000" },
  { item: "Tooling and licences", amount: "$900 / year" },
  { item: "Training the team", amount: "$1,500" },
  { item: "Migration and cleanup", amount: "$2,400" },
];

const BENEFITS = [
  { item: "Faster decisions (3 h saved per person)", amount: "$31,000" },
  { item: "One tool instead of four", amount: "$4,200 / year" },
  { item: "Fewer handoffs, less rework", amount: "20% less rework" },
  { item: "Faster onboarding (2 days instead of 5)", amount: "$3,000" },
  { item: "One shared picture of the work", amount: "Hard to price" },
];

const COLUMNS = [
  {
    id: "cost",
    title: "Costs",
    x: FIRST_COLUMN_X,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    rows: COSTS,
  },
  {
    id: "benefit",
    title: "Benefits",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    rows: BENEFITS,
  },
];

const columnElements = (
  column: typeof COLUMNS[number],
): TemplateElementSpec[] => {
  const elements: TemplateElementSpec[] = [
    {
      kind: "rectangle",
      id: `${column.id}-header`,
      x: column.x,
      y: HEADER_Y,
      width: COLUMN_WIDTH,
      height: HEADER_HEIGHT,
      label: column.title,
      fontSize: 18,
      backgroundColor: column.background,
      strokeColor: column.stroke,
      roundness: true,
    },
  ];

  column.rows.forEach((row, index) => {
    const y = FIRST_ROW_Y + index * ROW_HEIGHT;

    elements.push(
      {
        kind: "text",
        id: `${column.id}-item-${index + 1}`,
        x: column.x + 8,
        y,
        width: 280,
        height: 20,
        text: row.item,
        fontSize: 15,
      },
      {
        kind: "text",
        id: `${column.id}-amount-${index + 1}`,
        x: column.x + 300,
        y,
        width: COLUMN_WIDTH - 308,
        height: 20,
        text: row.amount,
        fontSize: 15,
        align: "right",
        color: COLOR_PALETTE.gray[4],
      },
      {
        kind: "arrow",
        id: `${column.id}-rule-${index + 1}`,
        x: column.x,
        y: y + 38,
        dx: COLUMN_WIDTH,
        dy: 0,
        strokeColor: COLOR_PALETTE.gray[1],
        strokeWidth: 1,
        strokeStyle: "dashed" as const,
        arrowhead: false,
      },
    );
  });

  return elements;
};

export const costBenefitAnalysisTemplate: ExcalidrawTemplate = {
  id: "cost-benefit-analysis",
  nameKey: "labels.templates.items.costBenefitAnalysis.name",
  descriptionKey: "labels.templates.items.costBenefitAnalysis.description",
  category: "business",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Cost–Benefit Analysis",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "One row per consideration. Put the money on the right, then total both columns.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...COLUMNS.flatMap(columnElements),
    {
      kind: "rectangle",
      id: "verdict",
      x: FIRST_COLUMN_X,
      y: FIRST_ROW_Y + ROWS * ROW_HEIGHT + 10,
      width: COLUMN_WIDTH * 2 + COLUMN_GAP,
      height: 64,
      label: "Verdict",
      fontSize: 17,
      textAlign: "left",
      verticalAlign: "top",
      backgroundColor: COLOR_PALETTE.gray[0],
      strokeColor: COLOR_PALETTE.gray[3],
      roundness: true,
    },
    {
      kind: "text",
      id: "verdict-hint",
      x: FIRST_COLUMN_X + 5,
      y: FIRST_ROW_Y + ROWS * ROW_HEIGHT + 42,
      width: COLUMN_WIDTH * 2 + COLUMN_GAP - 12,
      height: 20,
      text: "Total cost: $24,000   ·   Total benefit: $38,200+   ·   Payback: 8 months",
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
