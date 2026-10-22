import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The org chart: who reports to whom, drawn the way an org chart is drawn —
 * one box at the top, a line across, and the branches hanging from it.
 */

const CEO_WIDTH = 200;
const HEAD_WIDTH = 200;
const REPORT_WIDTH = 170;

const CEO_X = 520;
const CEO_Y = 110;
const CEO_HEIGHT = 72;

const HEAD_Y = 260;
const HEAD_HEIGHT = 62;

const REPORT_Y = 390;
const REPORT_HEIGHT = 58;

/** the line the branches hang from */
const BUS_Y = 215;

const CEO: PanelBlock = {
  id: "ceo",
  title: "Chief Executive Officer",
  x: CEO_X,
  y: CEO_Y,
  width: CEO_WIDTH,
  height: CEO_HEIGHT,
  background: COLOR_PALETTE.violet[0],
  stroke: COLOR_PALETTE.violet[3],
  items: ["Alex Morgan"],
};

const HEADS: PanelBlock[] = [
  {
    id: "product",
    title: "VP Product",
    x: 140,
    y: HEAD_Y,
    width: HEAD_WIDTH,
    height: HEAD_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[3],
    items: ["Priya Raman"],
  },
  {
    id: "engineering",
    title: "VP Engineering",
    x: 520,
    y: HEAD_Y,
    width: HEAD_WIDTH,
    height: HEAD_HEIGHT,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[3],
    items: ["Sam Okonkwo"],
  },
  {
    id: "go-to-market",
    title: "VP Go-to-market",
    x: 900,
    y: HEAD_Y,
    width: HEAD_WIDTH,
    height: HEAD_HEIGHT,
    background: COLOR_PALETTE.orange[0],
    stroke: COLOR_PALETTE.orange[3],
    items: ["Dana Feld"],
  },
];

const REPORTS: (PanelBlock & { parent: string })[] = [
  {
    id: "design-lead",
    title: "Design Lead",
    parent: "product",
    x: 60,
    y: REPORT_Y,
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Lena Hoffmann"],
  },
  {
    id: "product-manager",
    title: "Product Manager",
    parent: "product",
    x: 250,
    y: REPORT_Y,
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Tomás Ruiz"],
  },
  {
    id: "platform-lead",
    title: "Platform Lead",
    parent: "engineering",
    x: 460,
    y: REPORT_Y,
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Ivy Chen"],
  },
  {
    id: "qa-lead",
    title: "QA Lead",
    parent: "engineering",
    x: 650,
    y: REPORT_Y,
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Rob Yates"],
  },
  {
    id: "sales-lead",
    title: "Sales Lead",
    parent: "go-to-market",
    x: 820,
    y: REPORT_Y,
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Noor Haddad"],
  },
  {
    id: "customer-success",
    title: "Customer Success",
    parent: "go-to-market",
    x: 1010,
    y: REPORT_Y,
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Kai Lindqvist"],
  },
];

const LINE = COLOR_PALETTE.gray[3];

const centerOf = (block: { x: number; width: number }) =>
  block.x + block.width / 2;

/** a straight line, used to hang the boxes off each other */
const line = (
  id: string,
  x: number,
  y: number,
  dx: number,
  dy: number,
): TemplateElementSpec => ({
  kind: "arrow",
  id,
  x,
  y,
  dx,
  dy,
  strokeColor: LINE,
  strokeWidth: 1,
  arrowhead: false,
});

export const orgChartTemplate: ExcalidrawTemplate = {
  id: "org-chart",
  nameKey: "labels.templates.items.orgChart.name",
  descriptionKey: "labels.templates.items.orgChart.description",
  category: "business",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Org Chart",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Swap the roles and the names; the lines stay as they are.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    // the line from the top box down to the bar the branches hang from
    line(
      "ceo-stub",
      centerOf(CEO),
      CEO_Y + CEO_HEIGHT,
      0,
      BUS_Y - (CEO_Y + CEO_HEIGHT),
    ),
    line(
      "bus",
      centerOf(HEADS[0]),
      BUS_Y,
      centerOf(HEADS[HEADS.length - 1]) - centerOf(HEADS[0]),
      0,
    ),
    ...HEADS.flatMap((head) => [
      line(`${head.id}-drop`, centerOf(head), BUS_Y, 0, HEAD_Y - BUS_Y),
      // the lines from the head down to its own reports
      ...REPORTS.filter((report) => report.parent === head.id).map((report) =>
        line(
          `${head.id}-to-${report.id}`,
          centerOf(head),
          HEAD_Y + HEAD_HEIGHT,
          centerOf(report) - centerOf(head),
          REPORT_Y - (HEAD_Y + HEAD_HEIGHT),
        ),
      ),
    ]),
    ...[CEO, ...HEADS, ...REPORTS].flatMap(panelElements),
  ],
};
