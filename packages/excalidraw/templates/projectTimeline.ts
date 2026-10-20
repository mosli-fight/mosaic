import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The project timeline: a spine with the phases above it and the milestones
 * below it, so that a plan can be read at a glance.
 */

const LINE_Y = 320;
const LINE_START_X = 60;
const LINE_LENGTH = 780;

const PHASES = [
  {
    id: "discovery",
    title: "Discovery",
    start: 0,
    width: 180,
    background: COLOR_PALETTE.blue[1],
    stroke: COLOR_PALETTE.blue[3],
  },
  {
    id: "build",
    title: "Build",
    start: 200,
    width: 180,
    background: COLOR_PALETTE.violet[1],
    stroke: COLOR_PALETTE.violet[3],
  },
  {
    id: "test",
    title: "Test",
    start: 400,
    width: 180,
    background: COLOR_PALETTE.orange[1],
    stroke: COLOR_PALETTE.orange[3],
  },
  {
    id: "launch",
    title: "Launch",
    start: 600,
    width: 180,
    background: COLOR_PALETTE.green[1],
    stroke: COLOR_PALETTE.green[3],
  },
];

const MILESTONES = [
  { id: "brief", title: "Brief signed off", at: 90 },
  { id: "design", title: "Design approved", at: 290 },
  { id: "beta", title: "Beta released", at: 490 },
  { id: "live", title: "Go live", at: 690 },
];

export const projectTimelineTemplate: ExcalidrawTemplate = {
  id: "project-timeline",
  nameKey: "labels.templates.items.projectTimeline.name",
  descriptionKey: "labels.templates.items.projectTimeline.description",
  category: "strategy",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Project Timeline",
      fontSize: 32,
    },
    ...PHASES.map((phase) => ({
      kind: "rectangle" as const,
      id: `${phase.id}-bar`,
      x: LINE_START_X + phase.start,
      y: 130,
      width: phase.width,
      height: 70,
      label: phase.title,
      fontSize: 18,
      backgroundColor: phase.background,
      strokeColor: phase.stroke,
      roundness: true,
    })),
    {
      kind: "arrow",
      id: "spine",
      x: LINE_START_X,
      y: LINE_Y,
      dx: LINE_LENGTH,
      dy: 0,
      strokeColor: COLOR_PALETTE.gray[4],
      strokeWidth: 2,
    },
    ...MILESTONES.map((milestone) => ({
      kind: "ellipse" as const,
      id: `${milestone.id}-dot`,
      x: LINE_START_X + milestone.at - 9,
      y: LINE_Y - 9,
      width: 18,
      height: 18,
      backgroundColor: COLOR_PALETTE.white,
      strokeColor: COLOR_PALETTE.gray[4],
      strokeWidth: 2,
    })),
    ...MILESTONES.map((milestone) => ({
      kind: "text" as const,
      id: `${milestone.id}-label`,
      x: LINE_START_X + milestone.at - 80,
      y: LINE_Y + 30,
      width: 160,
      height: 24,
      text: milestone.title,
      fontSize: 15,
      align: "center" as const,
    })),
  ],
};
