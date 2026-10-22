/**
 * The drawing of an icon, and the ways it is turned into an image.
 *
 * The drawings themselves live in a catalogue of their own (`./icons`),
 * which is only fetched when the icons tab of the media panel is opened, or
 * when a diagram asks for an icon. What is left here are the parts that are
 * needed the moment an icon is put on the board — they are small, and they
 * are needed right away.
 *
 * Licensing: every glyph in the catalogue is an original geometric drawing
 * made for Mosaic. No vendor artwork is copied — vendor names are used only
 * to label the shapes, and the shapes themselves are simple tiles and marks.
 * See `ICONS-NOTE.md` beside this file.
 */

import { MIME_TYPES } from "@excalidraw/common";

import type { FileId } from "@excalidraw/element/types";

import type { DataURL } from "../../types";

/** the categories the icons are grouped into */
export type IconCategoryId =
  | "tech"
  | "databases"
  | "devops"
  | "aws"
  | "azure"
  | "gcp"
  | "kubernetes";

export type IconAsset = {
  /** a stable id, used for the icon in the scene and in the diagram DSL */
  id: string;
  /** the name of the icon, shown as its tooltip */
  name: string;
  /** the category the icon belongs to */
  category: IconCategoryId;
  /** the inside of the icon, drawn on a 100x100 canvas */
  body: string;
  /** other words the icon is found by */
  keywords?: readonly string[];
  /** other names the diagram DSL accepts for this icon */
  aliases?: readonly string[];
};

/** the size an icon lands on the board at */
export const ICON_SIZE = 96;

/**
 * The icon as a standalone SVG document.
 *
 * The document carries an explicit size and a viewBox, so that it renders
 * the same wherever it lands — the editor normalizes the frame of an SVG it
 * is given, and it will not do so for a document that only has a viewBox.
 */
export const iconToSVG = (icon: IconAsset): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">${icon.body}</svg>`;

/**
 * The icon as a data URL, ready to be handed to the editor as an image.
 *
 * The drawings are plain ASCII, so they are encoded as base64 — which is
 * what the editor expects of an SVG it stores, and what it needs in order
 * to normalize the document when the icon is added to the scene.
 */
export const iconToDataURL = (icon: IconAsset): DataURL =>
  `data:${MIME_TYPES.svg};base64,${btoa(iconToSVG(icon))}` as DataURL;

/**
 * The file id an icon carries when it is drawn inside a diagram.
 *
 * It is derived from the icon's id rather than drawn at random, so that a
 * re-parse finds the very same file instead of adding a second copy of it.
 */
export const ICON_FILE_ID_PREFIX = "diagram-icon-";

export const diagramIconFileId = (icon: IconAsset): FileId =>
  `${ICON_FILE_ID_PREFIX}${icon.id}` as FileId;
