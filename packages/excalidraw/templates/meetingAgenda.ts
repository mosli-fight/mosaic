import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The meeting agenda: a header for the meeting itself, a numbered list of
 * what the meeting is going to talk about, and a column for the notes that
 * come out of it.
 */

const AGENDA_ITEMS = [
  "Welcome & check-ins",
  "Review last week's decisions",
  "Demo & feedback",
  "Open discussion",
  "Actions & owners",
];

const agendaRows = AGENDA_ITEMS.map((label, index) => ({
  kind: "rectangle" as const,
  id: `item-${index + 1}`,
  x: 40,
  y: 170 + index * 56,
  width: 540,
  height: 44,
  label: `${index + 1}. ${label}`,
  textAlign: "left" as const,
  verticalAlign: "middle" as const,
  fontSize: 16,
  backgroundColor: COLOR_PALETTE.gray[0],
  strokeColor: COLOR_PALETTE.gray[2],
  roundness: true,
}));

export const meetingAgendaTemplate: ExcalidrawTemplate = {
  id: "meeting-agenda",
  nameKey: "labels.templates.items.meetingAgenda.name",
  descriptionKey: "labels.templates.items.meetingAgenda.description",
  category: "meetings",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Meeting Agenda",
      fontSize: 32,
    },
    {
      kind: "rectangle",
      id: "meeting",
      x: 40,
      y: 92,
      width: 540,
      height: 56,
      label: "Weekly sync — 30 min",
      fontSize: 18,
      textAlign: "left",
      backgroundColor: COLOR_PALETTE.blue[0],
      strokeColor: COLOR_PALETTE.blue[2],
      roundness: true,
    },
    ...agendaRows,
    {
      kind: "rectangle",
      id: "notes",
      x: 620,
      y: 92,
      width: 240,
      height: 400,
      label: "Notes",
      fontSize: 18,
      verticalAlign: "top",
      backgroundColor: COLOR_PALETTE.yellow[0],
      strokeColor: COLOR_PALETTE.yellow[2],
      roundness: true,
    },
  ],
};
