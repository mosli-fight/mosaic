import { COLOR_PALETTE } from "@excalidraw/common";

import { panelElements } from "./panel";

import type { ExcalidrawTemplate, TemplateElementSpec } from "./types";
import type { PanelBlock } from "./panel";

/**
 * The user story map: the activities a user goes through, the stories that
 * make each activity possible, and the slices that ship them.
 *
 * Reading it from the top down shows the order of a journey; reading it from
 * the bottom up shows what can be released first.
 */

const COLUMN_WIDTH = 300;
const COLUMN_GAP = 20;
const FIRST_COLUMN_X = 40;

const ACTIVITY_Y = 110;
const ACTIVITY_HEIGHT = 56;

const STORY_Y = 186;
const STORY_WIDTH = 280;
const STORY_HEIGHT = 74;
const STORY_GAP = 12;

const SLICE_Y = 400;
const SLICE_HEIGHT = 110;

const ACTIVITIES: PanelBlock[] = [
  {
    id: "set-up",
    title: "Set up the workspace",
    x: FIRST_COLUMN_X,
    y: ACTIVITY_Y,
    width: COLUMN_WIDTH,
    height: ACTIVITY_HEIGHT,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
  },
  {
    id: "plan",
    title: "Plan the work",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: ACTIVITY_Y,
    width: COLUMN_WIDTH,
    height: ACTIVITY_HEIGHT,
    background: COLOR_PALETTE.violet[0],
    stroke: COLOR_PALETTE.violet[2],
  },
  {
    id: "share",
    title: "Share the outcome",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: ACTIVITY_Y,
    width: COLUMN_WIDTH,
    height: ACTIVITY_HEIGHT,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
  },
];

const STORIES: { column: number; text: string; points: string }[] = [
  {
    column: 0,
    text: "As a new user, I want to start from a template",
    points: "5 points",
  },
  {
    column: 0,
    text: "As a new user, I want to see an example board",
    points: "3 points",
  },
  {
    column: 1,
    text: "As a planner, I want every task in one place",
    points: "8 points",
  },
  {
    column: 1,
    text: "As a planner, I want to give a task an owner",
    points: "3 points",
  },
  {
    column: 2,
    text: "As a lead, I want to share a board with a link",
    points: "5 points",
  },
  {
    column: 2,
    text: "As a lead, I want to see who has opened it",
    points: "2 points",
  },
];

const SLICES: PanelBlock[] = [
  {
    id: "slice-skeleton",
    title: "Walking skeleton",
    x: FIRST_COLUMN_X,
    y: SLICE_Y,
    width: COLUMN_WIDTH,
    height: SLICE_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["A board that opens, and nothing else"],
  },
  {
    id: "slice-usable",
    title: "First usable board",
    x: FIRST_COLUMN_X + COLUMN_WIDTH + COLUMN_GAP,
    y: SLICE_Y,
    width: COLUMN_WIDTH,
    height: SLICE_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["Start, plan and share in one board"],
  },
  {
    id: "slice-team",
    title: "Team rollout",
    x: FIRST_COLUMN_X + (COLUMN_WIDTH + COLUMN_GAP) * 2,
    y: SLICE_Y,
    width: COLUMN_WIDTH,
    height: SLICE_HEIGHT,
    background: COLOR_PALETTE.gray[0],
    stroke: COLOR_PALETTE.gray[3],
    items: ["The whole team, every template"],
  },
];

const storyElements = (): TemplateElementSpec[] =>
  STORIES.flatMap((story, index) => {
    const column = ACTIVITIES[story.column];
    const row = STORIES.filter(
      (entry) => entry.column === story.column,
    ).indexOf(story);
    const x = column.x + 10;
    const y = STORY_Y + row * (STORY_HEIGHT + STORY_GAP);

    return [
      {
        kind: "rectangle" as const,
        id: `story-card-${index + 1}`,
        x,
        y,
        width: STORY_WIDTH,
        height: STORY_HEIGHT,
        label: story.text,
        fontSize: 14,
        textAlign: "left" as const,
        verticalAlign: "top" as const,
        backgroundColor: COLOR_PALETTE.white,
        strokeColor: COLOR_PALETTE.gray[2],
        roundness: true,
      },
      {
        kind: "text" as const,
        id: `story-points-${index + 1}`,
        x: x + 10,
        y: y + STORY_HEIGHT - 24,
        width: 120,
        height: 18,
        text: story.points,
        fontSize: 12,
        color: COLOR_PALETTE.gray[4],
      },
    ];
  });

export const userStoryMapTemplate: ExcalidrawTemplate = {
  id: "user-story-map",
  nameKey: "labels.templates.items.userStoryMap.name",
  descriptionKey: "labels.templates.items.userStoryMap.description",
  category: "agile",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "User Story Map",
      fontSize: 32,
    },
    {
      kind: "text",
      id: "hint",
      x: 40,
      y: 66,
      width: 900,
      height: 24,
      text: "Activities across the top, the stories under them, and the release slices at the bottom.",
      fontSize: 16,
      color: COLOR_PALETTE.gray[4],
    },
    ...ACTIVITIES.flatMap(panelElements),
    ...storyElements(),
    ...SLICES.flatMap(panelElements),
    {
      kind: "text",
      id: "slices-label",
      x: FIRST_COLUMN_X,
      y: SLICE_Y - 30,
      width: 300,
      height: 22,
      text: "Release slices",
      fontSize: 16,
    },
  ],
};
