/**
 * Where an arrow between two shapes starts and ends.
 *
 * A diagram's arrows are written as "from this shape to that one", not as
 * coordinates: the coordinates are derived from the shapes, so an arrow can
 * be drawn the moment the shapes are. The same derivation is used by the
 * gallery's preview (which only has the specs) and by the builder (which
 * has the elements), so the picture on the card is the picture on the board.
 *
 * The endpoints sit on each shape's outline, pushed out by the gap the
 * editor leaves between an arrow and the shape it is bound to. That is what
 * makes the arrow look attached rather than merely close.
 */

/** the shape a connector runs between, in scene coordinates */
export type ConnectorBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "rectangle" | "ellipse" | "diamond";
};

export type ConnectorGeometry = {
  /** the arrow's start, in scene coordinates */
  x: number;
  y: number;
  /** how far the arrow reaches from its start */
  dx: number;
  dy: number;
  /** where the start sits inside the from-shape, as a ratio of its box */
  startFixedPoint: readonly [number, number];
  /** where the end sits inside the to-shape, as a ratio of its box */
  endFixedPoint: readonly [number, number];
};

/**
 * The gap the editor leaves between an arrow's endpoint and the shape it is
 * bound to (`BASE_BINDING_GAP` plus half the shape's stroke width).
 */
const BINDING_GAP = 5 + 0.5;

/** a ratio the editor accepts as a fixed point */
const normalizeRatio = (ratio: number): number => {
  const clamped = Math.min(10, Math.max(-10, ratio));
  // the editor nudges an exact half off the centre so the arrow's heading
  // does not jump on floating-point noise
  return Math.abs(clamped - 0.5) < 0.0001 ? 0.5001 : clamped;
};

/**
 * How far from a shape's centre the ray leaves its outline, for a unit
 * direction `(ux, uy)`.
 *
 * Each shape is the same problem in a different norm: a rectangle leaves
 * where the ray crosses the nearer of its two pairs of sides, an ellipse
 * where it crosses the ellipse, a diamond where it crosses the rhombus.
 */
const exitDistance = (
  box: ConnectorBox,
  ux: number,
  uy: number,
): number => {
  const halfWidth = box.width / 2 + BINDING_GAP;
  const halfHeight = box.height / 2 + BINDING_GAP;

  switch (box.kind) {
    case "ellipse":
      return 1 / Math.sqrt((ux / halfWidth) ** 2 + (uy / halfHeight) ** 2);
    case "diamond":
      return 1 / (Math.abs(ux) / halfWidth + Math.abs(uy) / halfHeight);
    case "rectangle":
    default: {
      const horizontal = ux === 0 ? Infinity : halfWidth / Math.abs(ux);
      const vertical = uy === 0 ? Infinity : halfHeight / Math.abs(uy);
      return Math.min(horizontal, vertical);
    }
  }
};

/**
 * The geometry of an arrow from one shape to another.
 *
 * The arrow runs along the line between the two centres. When the shapes
 * overlap — or sit so close that the two outline points would cross — each
 * endpoint is pulled back to just under half the distance, so the arrow
 * keeps its direction instead of turning inside out.
 */
export const connectorGeometry = (
  from: ConnectorBox,
  to: ConnectorBox,
): ConnectorGeometry => {
  const fromX = from.x + from.width / 2;
  const fromY = from.y + from.height / 2;
  const toX = to.x + to.width / 2;
  const toY = to.y + to.height / 2;

  const distance = Math.hypot(toX - fromX, toY - fromY) || 1;
  const ux = (toX - fromX) / distance;
  const uy = (toY - fromY) / distance;

  // never let the two outline points pass each other
  const reach = Math.max(distance * 0.45, 1);

  const startDistance = Math.min(exitDistance(from, ux, uy), reach);
  const endDistance = Math.min(exitDistance(to, -ux, -uy), reach);

  const x = fromX + ux * startDistance;
  const y = fromY + uy * startDistance;
  const endX = toX - ux * endDistance;
  const endY = toY - uy * endDistance;

  return {
    x,
    y,
    dx: endX - x,
    dy: endY - y,
    startFixedPoint: [
      normalizeRatio((x - from.x) / (from.width || 1)),
      normalizeRatio((y - from.y) / (from.height || 1)),
    ],
    endFixedPoint: [
      normalizeRatio((endX - to.x) / (to.width || 1)),
      normalizeRatio((endY - to.y) / (to.height || 1)),
    ],
  };
};
