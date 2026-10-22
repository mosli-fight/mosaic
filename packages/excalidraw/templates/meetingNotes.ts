import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The meeting notes: what the meeting was about, what was decided, and what
 * happens next — the three things a meeting is worth writing down.
 */

const HEADER_Y = 100;
const HEADER_HEIGHT = 74;

const COLUMN_Y = 200;
const COLUMN_HEIGHT = 300;

const ACTIONS_Y = 540;
const ACTION_ROW_HEIGHT = 38;

const ACTIONS_WIDTH = 900;

const ACTIONS = [
  { action: "Send the notes to the team", owner: "Priya", due: "Today" },
  { action: "Draft the onboarding brief", owner: "Alex", due: "Thursday" },
  { action: "Book the customer call", owner: "Dana", due: "Friday" },
];

const HEADER_PANELS: PanelBlock[] = [
  {
    id: "when",
    title: "When",
    x: 40,
    y: HEADER_Y,
    width: 300,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Tuesday, 10:00–10:45", "Room 2 or the video call"],
  },
  {
    id: "attendees",
    title: "Attendees",
    x: 360,
    y: HEADER_Y,
    width: 380,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Alex, Priya, Sam, Dana, Lena"],
  },
  {
    id: "goal",
    title: "Goal of the meeting",
    x: 760,
    y: HEADER_Y,
    width: 380,
    height: HEADER_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    items: ["Decide on the launch date"],
  },
];

const COLUMNS: PanelBlock[] = [
  {
    id: "agenda",
    title: "Agenda",
    x: 40,
    y: COLUMN_Y,
    width: 250,
    height: COLUMN_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: [
      "1. Welcome and apologies",
      "2. Last week's actions",
      "3. The launch plan",
      "4. Open questions",
      "5. Next steps",
    ],
  },
  {
    id: "notes",
    title: "Notes",
    x: 310,
    y: COLUMN_Y,
    width: 340,
    height: COLUMN_HEIGHT,
    background: COLOR_PALETTE.white,
    stroke: COLOR_PALETTE.gray[3],
    items: [
      "What was said, in one line each:",
      "The launch date moves to the 14th.",
      "Two features are cut from scope.",
      "Support needs the new pricing page.",
      "Questions to answer before Friday.",
    ],
  },
  {
    id: "decisions",
    title: "Decisions",
    x: 670,
    y: COLUMN_Y,
    width: 250,
    height: COLUMN_HEIGHT,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    items: ["Launch on the 14th", "Cut live chat", "Pricing page first"],
  },
];

const actionElements = (): TemplateElementSpec[] => {
  const elements: TemplateElementSpec[] = [
    {
      kind: "text",
      id: "actions-title",
      x: 40,
      y: ACTIONS_Y,
      width: 300,
      height: 24,
      text: "Action items",
      fontSize: 18,
    },
    {
      kind: "text",
      id: "actions-column-owner",
      x: 640,
      y: ACTIONS_Y + 4,
      width: 140,
      height: 20,
      text: "Owner",
      fontSize: 13,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "actions-column-due",
      x: 820,
      y: ACTIONS_Y + 4,
      width: 112,
      height: 20,
      text: "Due",
      fontSize: 13,
      align: "right",
      color: COLOR_PALETTE.gray[4],
    },
  ];

  ACTIONS.forEach((row, index) => {
    const y = ACTIONS_Y + 30 + index * ACTION_ROW_HEIGHT;

    elements.push(
      {
        kind: "text",
        id: `action-${index + 1}`,
        x: 48,
        y,
        width: 560,
        height: 20,
        text: row.action,
        fontSize: 15,
      },
      {
        kind: "text",
        id: `action-owner-${index + 1}`,
        x: 640,
        y,
        width: 140,
        height: 20,
        text: row.owner,
        fontSize: 15,
        color: COLOR_PALETTE.gray[4],
      },
      {
        kind: "text",
        id: `action-due-${index + 1}`,
        x: 820,
        y,
        width: 112,
        height: 20,
        text: row.due,
        fontSize: 15,
        align: "right",
        color: COLOR_PALETTE.gray[4],
      },
      {
        kind: "arrow",
        id: `action-rule-${index + 1}`,
        x: 40,
        y: y + 26,
        dx: ACTIONS_WIDTH,
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

export const meetingNotesTemplate: ExcalidrawTemplate = {
  id: "meeting-notes",
  nameKey: "labels.templates.items.meetingNotes.name",
  descriptionKey: "labels.templates.items.meetingNotes.description",
  category: "meetings",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Meeting Notes",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Agenda, notes and decisions side by side, with the actions underneath.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...HEADER_PANELS.flatMap(panelElements),
    ...COLUMNS.flatMap(panelElements),
    ...actionElements(),
  ],
};
