/**
 * The drawing of a sticker, and the ways it is turned into an image.
 *
 * The drawings themselves live in a catalogue of their own (`./stickers`),
 * which is only fetched when the stickers tab of the media panel is opened.
 * What is left here are the parts that are needed the moment a sticker is
 * put on the board — they are small, and they are needed right away.
 */

import { MIME_TYPES } from "@excalidraw/common";

import type { DataURL } from "../../types";

/** the categories the stickers are grouped into */
export type StickerCategoryId =
  | "faces"
  | "animals"
  | "gestures"
  | "objects"
  | "symbols"
  | "nature"
  | "celebration";

export type Sticker = {
  /** a stable id, used for the sticker in the scene */
  id: string;
  /** the name of the sticker, shown as its tooltip */
  name: string;
  /** the category the sticker belongs to */
  category: StickerCategoryId;
  /** the inside of the sticker, drawn on a 100x100 canvas */
  body: string;
  /** whether the sticker is drawn upside down */
  flip?: boolean;
  /** other words the sticker is found by */
  keywords?: readonly string[];
};

/** the size a sticker lands on the board at */
export const STICKER_SIZE = 120;

/**
 * The sticker as a standalone SVG document.
 *
 * The document carries an explicit size and a viewBox, so that it renders
 * the same wherever it lands — the editor normalizes the frame of an SVG it
 * is given, and it will not do so for a document that only has a viewBox.
 */
export const stickerToSVG = (sticker: Sticker): string => {
  const transform = sticker.flip
    ? `<g transform="translate(0,100) scale(1,-1)">${sticker.body}</g>`
    : sticker.body;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${transform}</svg>`;
};

/**
 * The sticker as a data URL, ready to be handed to the editor as an image.
 *
 * The drawing is plain ASCII, so it is encoded as base64 — which is what
 * the editor expects of an SVG it stores, and what it needs in order to
 * normalize the document when the sticker is added to the scene.
 */
export const stickerToDataURL = (sticker: Sticker): DataURL =>
  `data:${MIME_TYPES.svg};base64,${btoa(stickerToSVG(sticker))}` as DataURL;
