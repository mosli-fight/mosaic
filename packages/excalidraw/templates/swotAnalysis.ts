import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The SWOT analysis: the four quadrants — strengths, weaknesses,
 * opportunities and threats — each with a couple of notes in it.
 */

const QUADRANT_WIDTH = 360;
const QUADRANT_HEIGHT = 230;
const QUADRANT_GAP = 20;

const QUADRANTS = [
  {
    id: "strengths",
    title: "Strengths",
    hint: "Internal · helpful",
    x: 40,
    y: 100,
    background: COLOR_PALETTE.green[0],
    stroke: COLOR_PALETTE.green[2],
    notes: ["What we do well", "Our unfair advantage"],
  },
  {
    id: "weaknesses",
    title: "Weaknesses",
    hint: "Internal · harmful",
    x: 40 + QUADRANT_WIDTH + QUADRANT_GAP,
    y: 100,
    background: COLOR_PALETTE.red[0],
    stroke: COLOR_PALETTE.red[2],
    notes: ["Where we fall short", "What costs us the most"],
  },
  {
    id: "opportunities",
    title: "Opportunities",
    hint: "External · helpful",
    x: 40,
    y: 100 + QUADRANT_HEIGHT + QUADRANT_GAP,
    background: COLOR_PALETTE.blue[0],
    stroke: COLOR_PALETTE.blue[2],
    notes: ["What the market wants", "Who we could reach"],
  },
  {
    id: "threats",
    title: "Threats",
    hint: "External · harmful",
    x: 40 + QUADRANT_WIDTH + QUADRANT_GAP,
    y: 100 + QUADRANT_HEIGHT + QUADRANT_GAP,
    background: COLOR_PALETTE.orange[0],
    stroke: COLOR_PALETTE.orange[2],
    notes: ["Who is moving faster", "What could change"],
  },
];

const NOTE_WIDTH = 150;
const NOTE_HEIGHT = 110;

export const swotAnalysisTemplate: ExcalidrawTemplate = {
  id: "swot-analysis",
  nameKey: "labels.templates.items.swotAnalysis.name",
  descriptionKey: "labels.templates.items.swotAnalysis.description",
  category: "strategy",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "SWOT Analysis",
      fontSize: 32,
    },
    ...QUADRANTS.flatMap((quadrant) => [
      {
        kind: "rectangle" as const,
        id: `${quadrant.id}-box`,
        x: quadrant.x,
        y: quadrant.y,
        width: QUADRANT_WIDTH,
        height: QUADRANT_HEIGHT,
        label: quadrant.title,
        fontSize: 20,
        verticalAlign: "top" as const,
        backgroundColor: quadrant.background,
        strokeColor: quadrant.stroke,
        roundness: true,
      },
      {
        kind: "text" as const,
        id: `${quadrant.id}-hint`,
        x: quadrant.x + 12,
        y: quadrant.y + 40,
        width: QUADRANT_WIDTH - 24,
        height: 20,
        text: quadrant.hint,
        fontSize: 14,
        color: COLOR_PALETTE.gray[4],
      },
      ...quadrant.notes.map((note, index) => ({
        kind: "sticky" as const,
        id: `${quadrant.id}-note-${index + 1}`,
        x: quadrant.x + 20 + index * (NOTE_WIDTH + 20),
        y: quadrant.y + 76,
        width: NOTE_WIDTH,
        height: NOTE_HEIGHT,
        text: note,
        fontSize: 15,
        hue: "yellow" as const,
      })),
    ]),
  ],
};
