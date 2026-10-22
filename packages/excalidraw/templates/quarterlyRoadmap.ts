import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";

/**
 * The quarterly roadmap: the work of a quarter, laid out along the quarters
 * it is planned for, with a lane for every team that carries part of it.
 */

const LANE_LABEL_WIDTH = 140;
const FIRST_LANE_X = 40;

const QUARTER_WIDTH = 200;
const QUARTER_GAP = 20;
const FIRST_QUARTER_X = FIRST_LANE_X + LANE_LABEL_WIDTH + 20;

const LANE_HEIGHT = 100;
const FIRST_LANE_Y = 150;

const BAR_HEIGHT = 44;
const BAR_OFFSET = 14;

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];

const LANES = [
  {
    id: "growth",
    title: "Growth",
    background: COLOR_PALETTE.orange[0],
    stroke: COLOR_PALETTE.orange[2],
  },
  {
    id: "product",
    title: "Product",
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
  },
  {
    id: "platform",
    title: "Platform",
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
  },
];

type Bar = {
  id: string;
  lane: number;
  /** the first quarter the bar runs in */
  from: number;
  /** the number of quarters the bar runs for */
  length: number;
  label: string;
  background: string;
  stroke: string;
};

const BARS: Bar[] = [
  {
    id: "onboarding",
    lane: 0,
    from: 0,
    length: 2,
    label: "Onboarding revamp",
    background: COLOR_PALETTE.orange[1],
    stroke: COLOR_PALETTE.orange[3],
  },
  {
    id: "partners",
    lane: 0,
    from: 2,
    length: 2,
    label: "Partner programme",
    background: COLOR_PALETTE.orange[1],
    stroke: COLOR_PALETTE.orange[3],
  },
  {
    id: "gallery",
    lane: 1,
    from: 0,
    length: 1,
    label: "Template gallery",
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
  },
  {
    id: "mobile",
    lane: 1,
    from: 1,
    length: 1,
    label: "Mobile app",
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
  },
  {
    id: "collaboration",
    lane: 2,
    from: 0,
    length: 3,
    label: "Realtime collaboration",
    background: COLOR_PALETTE.green[1],
    stroke: COLOR_PALETTE.green[3],
  },
];

const quarterX = (index: number) =>
  FIRST_QUARTER_X + index * (QUARTER_WIDTH + QUARTER_GAP);

const laneY = (index: number) => FIRST_LANE_Y + index * (LANE_HEIGHT + 16);

const barElements = (bar: Bar): TemplateElementSpec[] => {
  const x = quarterX(bar.from);
  const width = bar.length * QUARTER_WIDTH + (bar.length - 1) * QUARTER_GAP;

  return [
    {
      kind: "rectangle",
      id: bar.id,
      x,
      y: laneY(bar.lane) + BAR_OFFSET,
      width,
      height: BAR_HEIGHT,
      label: bar.label,
      fontSize: 15,
      backgroundColor: bar.background,
      strokeColor: bar.stroke,
      roundness: true,
    },
  ];
};

export const quarterlyRoadmapTemplate: ExcalidrawTemplate = {
  id: "quarterly-roadmap",
  nameKey: "labels.templates.items.quarterlyRoadmap.name",
  descriptionKey: "labels.templates.items.quarterlyRoadmap.description",
  category: "strategy",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Quarterly Roadmap",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "One lane per team, one column per quarter. A bar that reaches further is a promise that lasts longer.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...QUARTERS.map((quarter, index) => ({
      kind: "text" as const,
      id: `quarter-${index + 1}`,
      x: quarterX(index),
      y: 116,
      width: QUARTER_WIDTH,
      height: 22,
      text: quarter,
      fontSize: 17,
      align: "center" as const,
    })),
    ...LANES.flatMap((lane, index) => [
      {
        kind: "rectangle" as const,
        id: lane.id,
        x: FIRST_LANE_X,
        y: laneY(index),
        width: LANE_LABEL_WIDTH,
        height: LANE_HEIGHT,
        label: lane.title,
        fontSize: 16,
        backgroundColor: lane.background,
        strokeColor: lane.stroke,
        roundness: true,
      },
      {
        kind: "arrow" as const,
        id: `${lane.id}-rule`,
        x: FIRST_LANE_X,
        y: laneY(index) + LANE_HEIGHT + 8,
        dx: QUARTER_WIDTH * 4 + QUARTER_GAP * 3 + LANE_LABEL_WIDTH + 20,
        dy: 0,
        strokeColor: COLOR_PALETTE.gray[1],
        strokeWidth: 1,
        strokeStyle: "dashed" as const,
        arrowhead: false,
      },
    ]),
    ...BARS.flatMap(barElements),
    {
      kind: "text",
      id: "today",
      x: FIRST_QUARTER_X - 60,
      y: FIRST_LANE_Y - 26,
      width: 120,
      height: 20,
      text: "◀ today",
      fontSize: 13,
      align: "center",
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
