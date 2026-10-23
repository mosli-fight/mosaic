/**
 * Painting a device frame's chrome.
 *
 * A device frame is a frame with a little of its device drawn on it: a
 * browser's bar, a phone's notch, a tablet's camera. The geometry comes from
 * `getFrameChromeLayout` in `@excalidraw/common`; this module is the one
 * place that turns it into pixels, so the canvas and the SVG export draw the
 * same thing.
 *
 * The chrome is painted in the frame's own coordinates, so the caller is
 * expected to have translated the context to the frame's top-left corner —
 * exactly what the frame outline is drawn in.
 */

import { THEME, applyDarkModeFilter } from "@excalidraw/common";

import type { FrameChromeLayout, FrameChromeRect } from "@excalidraw/common";

import type { Theme } from "./types";
import type { FrameDevice } from "./types";

/** the chrome's ink, in the light theme */
const CHROME_INK = "#495057";
/** the browser bar's paper, in the light theme */
const CHROME_BAR = "#f1f3f5";
/** the browser address pill, in the light theme */
const CHROME_PILL = "#ffffff";
/** the traffic-light dots, in the light theme */
const CHROME_DOT_COLORS = ["#ff6b6b", "#ffd43b", "#51cf66"] as const;

/** the theme-corrected version of a chrome color */
const ink = (color: string, theme: Theme) =>
  applyDarkModeFilter(color, theme === THEME.DARK);

/** the devices a frame can stand for */
export const FRAME_DEVICES = ["phone", "tablet", "desktop", "browser"] as const;

/**
 * Reads a device off a frame that came from a file.
 *
 * The value is untrusted — it is whatever a file (or a newer version of the
 * editor) put there — so anything that is not a device we know degrades to
 * a plain frame rather than to a frame with chrome nothing can draw.
 */
export const normalizeFrameDevice = (device: unknown): FrameDevice | null => {
  return typeof device === "string" &&
    (FRAME_DEVICES as readonly string[]).includes(device)
    ? (device as FrameDevice)
    : null;
};

const fillRoundedRect = (
  context: CanvasRenderingContext2D,
  rect: FrameChromeRect,
) => {
  context.beginPath();
  if (rect.radius && context.roundRect) {
    context.roundRect(rect.x, rect.y, rect.width, rect.height, rect.radius);
  } else {
    context.rect(rect.x, rect.y, rect.width, rect.height);
  }
  context.fill();
};

/**
 * Draws the chrome of a device frame onto a canvas.
 *
 * The context must already be translated to the frame's top-left corner.
 * Nothing is drawn for a device with no chrome (`desktop`) or for a frame
 * with no device at all.
 */
export const drawFrameChromeOnCanvas = (
  context: CanvasRenderingContext2D,
  layout: FrameChromeLayout,
  theme: Theme,
) => {
  if (layout.bar) {
    context.save();
    context.fillStyle = ink(CHROME_BAR, theme);
    fillRoundedRect(context, layout.bar);
    context.restore();
  }

  if (layout.pill) {
    context.save();
    context.fillStyle = ink(CHROME_PILL, theme);
    fillRoundedRect(context, layout.pill);
    context.restore();
  }

  if (layout.dots.length) {
    context.save();
    layout.dots.forEach((dot, index) => {
      context.beginPath();
      context.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      context.fillStyle = ink(
        CHROME_DOT_COLORS[index % CHROME_DOT_COLORS.length],
        theme,
      );
      context.fill();
    });
    context.restore();
  }

  if (layout.notch) {
    context.save();
    context.fillStyle = ink(CHROME_INK, theme);
    fillRoundedRect(context, layout.notch);
    context.restore();
  }

  if (layout.camera) {
    context.save();
    context.beginPath();
    context.arc(
      layout.camera.x,
      layout.camera.y,
      layout.camera.radius,
      0,
      Math.PI * 2,
    );
    context.fillStyle = ink(CHROME_INK, theme);
    context.fill();
    context.restore();
  }
};

/**
 * The chrome of a device frame as SVG nodes.
 *
 * The nodes are returned in the frame's own coordinates, for the caller to
 * place inside the frame's transform group.
 */
export const frameChromeToSvgNodes = (
  document: Document,
  layout: FrameChromeLayout,
  theme: Theme,
): SVGElement[] => {
  const nodes: SVGElement[] = [];

  const rect = (shape: FrameChromeRect, fill: string) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    node.setAttribute("x", `${shape.x}`);
    node.setAttribute("y", `${shape.y}`);
    node.setAttribute("width", `${shape.width}`);
    node.setAttribute("height", `${shape.height}`);
    if (shape.radius) {
      node.setAttribute("rx", `${shape.radius}`);
      node.setAttribute("ry", `${shape.radius}`);
    }
    node.setAttribute("fill", ink(fill, theme));
    nodes.push(node);
  };

  const circle = (x: number, y: number, radius: number, fill: string) => {
    const node = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "circle",
    );
    node.setAttribute("cx", `${x}`);
    node.setAttribute("cy", `${y}`);
    node.setAttribute("r", `${radius}`);
    node.setAttribute("fill", ink(fill, theme));
    nodes.push(node);
  };

  if (layout.bar) {
    rect(layout.bar, CHROME_BAR);
  }
  if (layout.pill) {
    rect(layout.pill, CHROME_PILL);
  }
  layout.dots.forEach((dot, index) => {
    circle(
      dot.x,
      dot.y,
      dot.radius,
      CHROME_DOT_COLORS[index % CHROME_DOT_COLORS.length],
    );
  });
  if (layout.notch) {
    rect(layout.notch, CHROME_INK);
  }
  if (layout.camera) {
    circle(layout.camera.x, layout.camera.y, layout.camera.radius, CHROME_INK);
  }

  return nodes;
};
