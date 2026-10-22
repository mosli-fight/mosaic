import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The bug triage board: the bugs as they are found, judged, worked on and
 * closed — with the severity that says how loudly each one is asking.
 */

const COLUMN_WIDTH = 240;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;

const HEADER_Y = 190;
const HEADER_HEIGHT = 46;

const CARD_WIDTH = 220;
const CARD_HEIGHT = 80;
const CARD_GAP = 12;
const FIRST_CARD_Y = 250;

const BADGE_WIDTH = 44;
const BADGE_HEIGHT = 22;

const SEVERITIES = [
  {
    id: "s1",
    label: "S1",
    note: "Broken for everyone",
    background: COLOR_PALETTE.red[1],
    stroke: COLOR_PALETTE.red[3],
  },
  {
    id: "s2",
    label: "S2",
    note: "Degraded, with a way round it",
    background: COLOR_PALETTE.orange[1],
    stroke: COLOR_PALETTE.orange[3],
  },
  {
    id: "s3",
    label: "S3",
    note: "Minor annoyance",
    background: COLOR_PALETTE.yellow[1],
    stroke: COLOR_PALETTE.yellow[3],
  },
  {
    id: "s4",
    label: "S4",
    note: "Cosmetic",
    background: COLOR_PALETTE.gray[1],
    stroke: COLOR_PALETTE.gray[3],
  },
];

const COLUMNS: (PanelBlock & {
  cards: { text: string; severity: string; owner: string }[];
})[] = [
  {
    id: "new",
    title: "New",
    x: FIRST_COLUMN_X,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.gray[1],
    stroke: COLOR_PALETTE.gray[3],
    cards: [
      {
        text: "The preview is blank on Safari 17",
        severity: "s1",
        owner: "unassigned",
      },
      {
        text: "The board name is lost on reload",
        severity: "s2",
        owner: "Sam",
      },
      { text: "The search ignores tags", severity: "s3", owner: "unassigned" },
    ],
  },
  {
    id: "triaged",
    title: "Triaged",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.violet[1],
    stroke: COLOR_PALETTE.violet[3],
    cards: [
      { text: "Cards duplicate after a paste", severity: "s2", owner: "Lena" },
      {
        text: "Sticky note text overflows its card",
        severity: "s3",
        owner: "Tomás",
      },
    ],
  },
  {
    id: "in-progress",
    title: "In progress",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
    cards: [
      {
        text: "Timeline arrows drift when moved",
        severity: "s2",
        owner: "Ivy",
      },
    ],
  },
  {
    id: "closed",
    title: "Closed",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 3,
    y: HEADER_Y,
    width: COLUMN_WIDTH,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.green[1],
    stroke: COLOR_PALETTE.green[3],
    cards: [
      {
        text: "The preview was unreadable on dark",
        severity: "s2",
        owner: "Rob",
      },
      {
        text: "The category tab lost its selection",
        severity: "s3",
        owner: "Alex",
      },
    ],
  },
];

const severityOf = (id: string) =>
  SEVERITIES.find((severity) => severity.id === id) ?? SEVERITIES[3];

const columnElements = (
  column: typeof COLUMNS[number],
): TemplateElementSpec[] => [
  ...panelElements({
    id: column.id,
    title: column.title,
    x: column.x,
    y: column.y,
    width: column.width,
    height: column.height,
    background: column.background,
    stroke: column.stroke,
    titleAlign: "center",
    titleVerticalAlign: "middle",
  }),
  ...column.cards.flatMap((card, index): TemplateElementSpec[] => {
    const x = column.x + 10;
    const y = FIRST_CARD_Y + index * (CARD_HEIGHT + CARD_GAP);
    const severity = severityOf(card.severity);

    return [
      ...panelElements({
        id: `${column.id}-card-${index + 1}`,
        title: card.text,
        x,
        y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        titleFontSize: 14,
        titleHeight: 46,
        background: COLOR_PALETTE.white,
        stroke: COLOR_PALETTE.gray[2],
        items: [card.owner],
      }),
      {
        kind: "rectangle",
        id: `${column.id}-badge-${index + 1}`,
        x: x + CARD_WIDTH - BADGE_WIDTH - 10,
        y: y + 10,
        width: BADGE_WIDTH,
        height: BADGE_HEIGHT,
        label: severity.label,
        fontSize: 13,
        backgroundColor: severity.background,
        strokeColor: severity.stroke,
        roundness: true,
      },
    ];
  }),
];

export const bugTriageBoardTemplate: ExcalidrawTemplate = {
  id: "bug-triage-board",
  nameKey: "labels.templates.items.bugTriageBoard.name",
  descriptionKey: "labels.templates.items.bugTriageBoard.description",
  category: "agile",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Bug Triage Board",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "A bug moves right as it is judged, worked on and closed. The badge says how loudly it is asking.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...SEVERITIES.flatMap((severity, index) => [
      {
        kind: "rectangle" as const,
        id: `legend-${severity.id}`,
        x: FIRST_COLUMN_X + index * 200,
        y: 110,
        width: 40,
        height: BADGE_HEIGHT,
        label: severity.label,
        fontSize: 13,
        backgroundColor: severity.background,
        strokeColor: severity.stroke,
        roundness: true,
      },
      {
        kind: "text" as const,
        id: `legend-note-${severity.id}`,
        x: FIRST_COLUMN_X + index * 200 + 50,
        y: 112,
        width: 140,
        height: 20,
        text: severity.note,
        fontSize: 13,
        color: COLOR_PALETTE.gray[4],
      },
    ]),
    ...COLUMNS.flatMap(columnElements),
  ],
};
