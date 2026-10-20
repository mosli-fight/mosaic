import { COLOR_PALETTE } from "@excalidraw/common";

import type { ExcalidrawTemplate } from "./types";

/**
 * The wireframe: a page laid out in the usual blocks — a bar at the top, a
 * hero, two columns of content and a call to action — on a frame, so the
 * wireframe reads as a page rather than as loose boxes.
 */

export const wireframeBasicsTemplate: ExcalidrawTemplate = {
  id: "wireframe-basics",
  nameKey: "labels.templates.items.wireframeBasics.name",
  descriptionKey: "labels.templates.items.wireframeBasics.description",
  category: "research",
  elements: [
    {
      kind: "text",
      id: "title",
      x: 40,
      y: 24,
      width: 600,
      height: 40,
      text: "Wireframe",
      fontSize: 32,
    },
    {
      kind: "frame",
      id: "page",
      x: 40,
      y: 100,
      width: 820,
      height: 500,
      name: "Homepage",
      fill: COLOR_PALETTE.white,
    },
    {
      kind: "rectangle",
      id: "navbar",
      x: 60,
      y: 120,
      width: 780,
      height: 48,
      inFrame: "page",
      label: "Navigation",
      fontSize: 15,
      backgroundColor: COLOR_PALETTE.gray[1],
      strokeColor: COLOR_PALETTE.gray[3],
    },
    {
      kind: "rectangle",
      id: "hero",
      x: 60,
      y: 188,
      width: 780,
      height: 150,
      inFrame: "page",
      label: "Hero — headline and call to action",
      fontSize: 18,
      backgroundColor: COLOR_PALETTE.blue[0],
      strokeColor: COLOR_PALETTE.blue[2],
    },
    {
      kind: "rectangle",
      id: "content-left",
      x: 60,
      y: 358,
      width: 375,
      height: 120,
      inFrame: "page",
      label: "Content block",
      fontSize: 15,
      backgroundColor: COLOR_PALETTE.gray[0],
      strokeColor: COLOR_PALETTE.gray[2],
    },
    {
      kind: "rectangle",
      id: "content-right",
      x: 465,
      y: 358,
      width: 375,
      height: 120,
      inFrame: "page",
      label: "Content block",
      fontSize: 15,
      backgroundColor: COLOR_PALETTE.gray[0],
      strokeColor: COLOR_PALETTE.gray[2],
    },
    {
      kind: "rectangle",
      id: "cta",
      x: 60,
      y: 498,
      width: 200,
      height: 56,
      inFrame: "page",
      label: "Button",
      fontSize: 16,
      backgroundColor: COLOR_PALETTE.green[1],
      strokeColor: COLOR_PALETTE.green[3],
      roundness: true,
    },
  ],
};
