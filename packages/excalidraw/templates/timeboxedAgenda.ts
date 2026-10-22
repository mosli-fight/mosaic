import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";

/**
 * The timeboxed agenda: a meeting given a shape, with every item given the
 * time it is allowed to take.
 *
 * The clock is the point of the template — a time that is written down is a
 * time the room keeps to.
 */

const ROW_HEIGHT = 66;
const FIRST_ROW_Y = 150;
const CARD_HEIGHT = 52;

const CARD_X = 232;
const CARD_WIDTH = 480;

const ITEMS = [
  {
    time: "09:00",
    duration: "10 min",
    topic: "Welcome and check-in",
    owner: "Priya",
  },
  {
    time: "09:10",
    duration: "25 min",
    topic: "The launch plan",
    owner: "Alex",
  },
  {
    time: "09:35",
    duration: "15 min",
    topic: "Demo of the new board",
    owner: "Sam",
  },
  {
    time: "09:50",
    duration: "30 min",
    topic: "Customer feedback round",
    owner: "Dana",
  },
  { time: "10:20", duration: "10 min", topic: "Break", owner: "—" },
  {
    time: "10:30",
    duration: "15 min",
    topic: "Decisions and next steps",
    owner: "Alex",
  },
];

const rowElements = (
  item: typeof ITEMS[number],
  index: number,
): TemplateElementSpec[] => {
  const y = FIRST_ROW_Y + index * ROW_HEIGHT;

  return [
    {
      kind: "text",
      id: `time-${index + 1}`,
      x: 48,
      y: y + 16,
      width: 80,
      height: 20,
      text: item.time,
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: `duration-${index + 1}`,
      x: 140,
      y: y + 16,
      width: 80,
      height: 20,
      text: item.duration,
      fontSize: 15,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "rectangle",
      id: `topic-${index + 1}`,
      x: CARD_X,
      y,
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      label: item.topic,
      fontSize: 15,
      backgroundColor: COLOR_PALETTE.white,
      strokeColor: COLOR_PALETTE.gray[2],
      roundness: true,
    },
    {
      kind: "text",
      id: `owner-${index + 1}`,
      x: 740,
      y: y + 16,
      width: 160,
      height: 20,
      text: item.owner,
      fontSize: 15,
    },
  ];
};

export const timeboxedAgendaTemplate: ExcalidrawTemplate = {
  id: "timeboxed-agenda",
  nameKey: "labels.templates.items.timeboxedAgenda.name",
  descriptionKey: "labels.templates.items.timeboxedAgenda.description",
  category: "meetings",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Timeboxed Agenda",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Give every item a start, a length and an owner. The room keeps to the clock.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "column-time",
      x: 48,
      y: 112,
      width: 80,
      height: 20,
      text: "Time",
      fontSize: 13,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "column-duration",
      x: 140,
      y: 112,
      width: 80,
      height: 20,
      text: "Length",
      fontSize: 13,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "column-topic",
      x: CARD_X,
      y: 112,
      width: 200,
      height: 20,
      text: "Topic",
      fontSize: 13,
      color: COLOR_PALETTE.gray[4],
    },
    {
      kind: "text",
      id: "column-owner",
      x: 740,
      y: 112,
      width: 160,
      height: 20,
      text: "Owner",
      fontSize: 13,
      color: COLOR_PALETTE.gray[4],
    },
    ...ITEMS.flatMap(rowElements),
    {
      kind: "text",
      id: "total",
      x: 620,
      y: FIRST_ROW_Y + ITEMS.length * ROW_HEIGHT + 12,
      width: 280,
      height: 20,
      text: "Total: 105 minutes",
      fontSize: 15,
      align: "right",
      color: COLOR_PALETTE.gray[4],
    },
  ],
};
