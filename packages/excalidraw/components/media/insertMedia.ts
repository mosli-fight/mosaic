/**
 * Putting media on the board.
 *
 * Four things can be added from the media panel: an emoji, a sticker, a GIF
 * and a video. They all land in the middle of the viewport and come back
 * selected, so that the user can drag them, scale them or delete them
 * straight away.
 *
 * The insertion goes through the editor's own machinery — the same path a
 * pasted element takes — so a sticker arrives as a real image with its file
 * attached, a GIF arrives as a real image whose file is the animated file
 * itself, and a video arrives as a real embeddable.
 */

import {
  DEFAULT_FONT_FAMILY,
  MIME_TYPES,
  normalizeLink,
  randomId,
  viewportCoordsToSceneCoords,
} from "@excalidraw/common";

import {
  embeddableURLValidator,
  getEmbedLink,
  newImageElement,
  newTextElement,
} from "@excalidraw/element";

import type { FileId } from "@excalidraw/element/types";

import { STICKER_SIZE, stickerToDataURL } from "./stickerDrawing";

import type { AppClassProperties, DataURL } from "../../types";

import type { Sticker } from "./stickerDrawing";

/** the size an emoji lands on the board at */
export const EMOJI_FONT_SIZE = 64;

/** the longest side a GIF lands on the board at */
export const GIF_MAX_SIZE = 320;

/**
 * The middle of the viewport, in scene coordinates.
 */
const getViewportCenter = (app: AppClassProperties) => {
  const { width, height, offsetLeft, offsetTop } = app.state;

  return viewportCoordsToSceneCoords(
    { clientX: width / 2 + offsetLeft, clientY: height / 2 + offsetTop },
    app.state,
  );
};

/**
 * Puts an emoji on the board as a text element.
 *
 * The emoji is text rather than an image so that it stays crisp at any
 * size, scales with the rest of the board and can be recoloured like any
 * other piece of writing.
 */
export const insertEmoji = (app: AppClassProperties, char: string) => {
  const element = newTextElement({
    x: 0,
    y: 0,
    text: char,
    fontSize: EMOJI_FONT_SIZE,
    fontFamily: DEFAULT_FONT_FAMILY,
    textAlign: "center",
    verticalAlign: "middle",
    strokeColor: app.state.currentItemStrokeColor,
    backgroundColor: "transparent",
  });

  app.addElementsFromPasteOrLibrary({
    elements: [element],
    files: null,
    position: "center",
  });
};

/**
 * Puts a sticker on the board as an image.
 *
 * The sticker travels as a data URL, which the editor stores as a file of
 * the scene — the same way an image dropped onto the board does.
 */
export const insertSticker = (app: AppClassProperties, sticker: Sticker) => {
  const fileId = randomId() as FileId;

  const element = newImageElement({
    type: "image",
    x: 0,
    y: 0,
    width: STICKER_SIZE,
    height: STICKER_SIZE,
    fileId,
    status: "pending",
    strokeColor: "transparent",
    backgroundColor: "transparent",
  });

  app.addElementsFromPasteOrLibrary({
    elements: [element],
    files: {
      [fileId]: {
        id: fileId,
        dataURL: stickerToDataURL(sticker),
        mimeType: MIME_TYPES.svg,
        created: Date.now(),
      },
    },
    position: "center",
  });
};

/** a GIF, ready to be put on the board */
export type GifData = {
  /** the animated file, whole and unresized */
  dataURL: DataURL;
  /** the size of the GIF, in pixels */
  width: number;
  height: number;
};

/**
 * The size a GIF lands on the board at.
 *
 * A GIF keeps its own proportions — squeezing one would stretch the very
 * thing that makes it worth putting on a board — but a very large one is
 * brought down to a size that fits on a board without swallowing it.
 */
const gifSize = (width: number, height: number) => {
  const safeWidth = width > 0 ? width : GIF_MAX_SIZE;
  const safeHeight = height > 0 ? height : GIF_MAX_SIZE;
  const longestSide = Math.max(safeWidth, safeHeight);
  const scale = longestSide > GIF_MAX_SIZE ? GIF_MAX_SIZE / longestSide : 1;

  return {
    width: Math.round(safeWidth * scale),
    height: Math.round(safeHeight * scale),
  };
};

/**
 * Puts a GIF on the board as an image.
 *
 * The file is the animated file itself — the very bytes the provider
 * served, kept as they are. Nothing here resizes or re-encodes it, because
 * a GIF that has been through an image resizer is a GIF that has stopped
 * moving, and a still of a moving picture is not what the user asked for.
 */
export const insertGif = (app: AppClassProperties, gif: GifData) => {
  const fileId = randomId() as FileId;
  const { width, height } = gifSize(gif.width, gif.height);

  const element = newImageElement({
    type: "image",
    x: 0,
    y: 0,
    width,
    height,
    fileId,
    status: "pending",
    strokeColor: "transparent",
    backgroundColor: "transparent",
  });

  app.addElementsFromPasteOrLibrary({
    elements: [element],
    files: {
      [fileId]: {
        id: fileId,
        dataURL: gif.dataURL,
        mimeType: MIME_TYPES.gif,
        created: Date.now(),
      },
    },
    position: "center",
  });
};

export type VideoInsertResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "invalid" | "unsupported" };

/**
 * Makes a link out of what the user pasted.
 *
 * A link without a protocol is a link the user typed from memory rather
 * than copied, so it gets one.
 */
const toVideoLink = (url: string) => {
  const trimmed = url.trim();

  if (!trimmed) {
    return null;
  }

  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return normalizeLink(withProtocol);
};

/**
 * Puts a video on the board as an embeddable.
 *
 * The link is checked twice: once against the domains the editor is
 * willing to embed at all, and once against the embeddables that are
 * actually videos — YouTube and Vimeo among them. A link that passes both
 * is put on the board in the middle of the viewport.
 */
export const insertVideo = (
  app: AppClassProperties,
  url: string,
): VideoInsertResult => {
  const link = toVideoLink(url);

  if (!link) {
    return { ok: false, reason: "empty" };
  }

  if (!embeddableURLValidator(link, app.props.validateEmbeddable)) {
    return { ok: false, reason: "invalid" };
  }

  const embedLink = getEmbedLink(link);

  if (!embedLink || embedLink.type !== "video" || embedLink.error) {
    return { ok: false, reason: "unsupported" };
  }

  const { w, h } = embedLink.intrinsicSize;
  const center = getViewportCenter(app);

  const element = app.insertEmbeddableElement({
    sceneX: center.x - w / 2,
    sceneY: center.y - h / 2,
    link,
  });

  if (!element) {
    return { ok: false, reason: "unsupported" };
  }

  app.setAppState({ selectedElementIds: { [element.id]: true } });

  return { ok: true };
};
