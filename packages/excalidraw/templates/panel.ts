import { COLOR_PALETTE } from "@excalidraw/common";

import type {
  TemplateElementSpec,
  TemplateShapeSpec,
  TemplateTextSpec,
} from "./types";

/**
 * The shape most of the templates are made of: a titled panel with a few
 * lines of content under the title.
 *
 * The title is the panel's *label* — bound to the panel, so selecting the
 * panel selects its title — and the lines are text standing on their own.
 * That way a panel can be moved as one piece while its lines can still be
 * edited one by one.
 */

export type PanelBlock = {
  /** the panel's id, unique within the template */
  id: string;
  /** the panel's title */
  title: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** the paper the panel is painted on */
  background?: string;
  /** the ink the panel is drawn in */
  stroke?: string;
  /** the lines under the title */
  items?: readonly string[];
  /** the size the lines are written in */
  itemFontSize?: number;
  /** the size the title is written in */
  titleFontSize?: number;
  /** where the title sits across the panel */
  titleAlign?: "left" | "center" | "right";
  /** where the title sits down the panel */
  titleVerticalAlign?: "top" | "middle" | "bottom";
  /** the ink the lines are written in */
  itemColor?: string;
  /**
   * the space the title takes before the first line.
   *
   * A title that wraps to two lines needs more room than one that does not,
   * so a card with a long title says so here.
   */
  titleHeight?: number;
};

/** the space a panel's title takes before its first line */
const TITLE_HEIGHT = 32;

/**
 * The elements of a panel: the panel itself, its title, and its lines.
 */
export const panelElements = (block: PanelBlock): TemplateElementSpec[] => {
  const panel: TemplateShapeSpec = {
    kind: "rectangle",
    id: block.id,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
    label: block.title,
    fontSize: block.titleFontSize ?? 15,
    textAlign: block.titleAlign ?? "left",
    verticalAlign: block.titleVerticalAlign ?? "top",
    backgroundColor: block.background ?? COLOR_PALETTE.gray[0],
    strokeColor: block.stroke ?? COLOR_PALETTE.gray[2],
    roundness: true,
  };

  const items = block.items ?? [];

  if (!items.length) {
    return [panel];
  }

  const fontSize = block.itemFontSize ?? 13;
  // a panel without a title has no title to make room for
  const offset = block.title ? block.titleHeight ?? TITLE_HEIGHT : 12;
  const spacing = Math.min(
    34,
    Math.max(19, (block.height - offset - 12) / items.length),
  );

  const lines: TemplateTextSpec[] = items.map((item, index) => ({
    kind: "text",
    id: `${block.id}-item-${index + 1}`,
    x: block.x + 5,
    y: block.y + offset + index * spacing,
    width: block.width - 12,
    height: 18,
    text: item,
    fontSize,
    color: block.itemColor ?? COLOR_PALETTE.gray[4],
  }));

  return [panel, ...lines];
};
