/**
 * The stickers the media panel offers.
 *
 * A sticker is a small drawing that lands on the board as an image. They
 * are bundled with the editor — plain SVG, a couple of kilobytes each —
 * so that a sticker costs nothing to load and works offline.
 *
 * The stickers are drawn on a 100x100 canvas and are described as the
 * inside of an `<svg>` element: the frame around them is added when the
 * sticker is turned into an image, which keeps the drawing free to be
 * flipped (a thumb down is a thumb up turned over) without the data having
 * to know about it.
 */

import { MIME_TYPES } from "@excalidraw/common";

import type { DataURL } from "../../types";

export type Sticker = {
  /** a stable id, used for the sticker in the scene */
  id: string;
  /** the name of the sticker, shown as its tooltip */
  name: string;
  /** the inside of the sticker, drawn on a 100x100 canvas */
  body: string;
  /** whether the sticker is drawn upside down */
  flip?: boolean;
};

/** the size a sticker lands on the board at */
export const STICKER_SIZE = 120;

export const STICKERS: readonly Sticker[] = [
  {
    id: "star",
    name: "Star",
    body: `<path d="M50 6 L61 38 L94 38 L67 57 L78 90 L50 69 L22 90 L33 57 L6 38 L39 38 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "star-outline",
    name: "Outline star",
    body: `<path d="M50 6 L61 38 L94 38 L67 57 L78 90 L50 69 L22 90 L33 57 L6 38 L39 38 Z" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linejoin="round"/>`,
  },
  {
    id: "sparkles",
    name: "Sparkles",
    body: `<path d="M38 8 L45 29 L66 36 L45 43 L38 64 L31 43 L10 36 L31 29 Z" fill="#fbbf24"/><path d="M76 48 L80 62 L94 66 L80 70 L76 84 L72 70 L58 66 L72 62 Z" fill="#f472b6"/><path d="M14 66 L17 76 L27 79 L17 82 L14 92 L11 82 L1 79 L11 76 Z" fill="#38bdf8"/>`,
  },
  {
    id: "heart",
    name: "Heart",
    body: `<path d="M50 90 C50 90 6 60 6 33 C6 17 19 6 32 6 C41 6 47 11 50 17 C53 11 59 6 68 6 C81 6 94 17 94 33 C94 60 50 90 50 90 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "heart-outline",
    name: "Outline heart",
    body: `<path d="M50 90 C50 90 6 60 6 33 C6 17 19 6 32 6 C41 6 47 11 50 17 C53 11 59 6 68 6 C81 6 94 17 94 33 C94 60 50 90 50 90 Z" fill="none" stroke="#ef4444" stroke-width="5" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-right",
    name: "Arrow",
    body: `<path d="M6 36 H56 V14 L94 50 L56 86 V64 H6 Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-up",
    name: "Arrow up",
    body: `<path d="M50 6 L86 44 H64 V94 H36 V44 H14 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-down",
    name: "Arrow down",
    body: `<path d="M50 94 L14 56 H36 V6 H64 V56 H86 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "check-circle",
    name: "Check",
    body: `<circle cx="50" cy="50" r="44" fill="#22c55e" stroke="#15803d" stroke-width="3"/><path d="M28 51 L44 67 L73 33" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "check-badge",
    name: "Check badge",
    body: `<rect x="8" y="8" width="84" height="84" rx="24" fill="#6366f1" stroke="#4338ca" stroke-width="3"/><path d="M30 51 L44 65 L71 35" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "thumbs-up",
    name: "Thumbs up",
    body: `<rect x="12" y="46" width="20" height="44" rx="7" fill="#d97706" stroke="#b45309" stroke-width="3"/><path d="M32 46 L50 13 C54 4 67 8 64 19 L59 38 H79 C87 38 91 47 88 55 L80 78 C78 85 71 90 63 90 H32 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "thumbs-down",
    name: "Thumbs down",
    body: `<rect x="12" y="46" width="20" height="44" rx="7" fill="#d97706" stroke="#b45309" stroke-width="3"/><path d="M32 46 L50 13 C54 4 67 8 64 19 L59 38 H79 C87 38 91 47 88 55 L80 78 C78 85 71 90 63 90 H32 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
    flip: true,
  },
  {
    id: "medal",
    name: "Medal",
    body: `<path d="M30 58 L22 96 L42 87 L50 97 L58 87 L78 96 L70 58 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="40" r="28" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M50 26 L53.5 35.2 L63.3 35.7 L55.7 41.9 L58.2 51.3 L50 46 L41.8 51.3 L44.3 41.9 L36.7 35.7 L46.5 35.2 Z" fill="#b45309"/>`,
  },
  {
    id: "rosette",
    name: "Rosette",
    body: `<g fill="#ec4899"><circle cx="50" cy="18" r="11"/><circle cx="76" cy="26" r="11"/><circle cx="88" cy="50" r="11"/><circle cx="76" cy="74" r="11"/><circle cx="50" cy="82" r="11"/><circle cx="24" cy="74" r="11"/><circle cx="12" cy="50" r="11"/><circle cx="24" cy="26" r="11"/><circle cx="50" cy="50" r="36"/></g><path d="M50 30 L55 43.1 L69 43.8 L58.1 52.6 L61.8 66.2 L50 58.5 L38.2 66.2 L41.9 52.6 L31 43.8 L45 43.1 Z" fill="#ffffff"/>`,
  },
  {
    id: "fire",
    name: "Fire",
    body: `<path d="M50 6 C59 24 74 31 74 53 A24 24 0 0 1 26 53 C26 42 33 35 40 29 C40 40 44 45 49 47 C44 34 46 18 50 6 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/><path d="M50 44 C56 51 61 56 61 63 A11 11 0 0 1 39 63 C39 56 45 50 50 44 Z" fill="#fbbf24"/>`,
  },
];

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

export const getStickerById = (id: string) =>
  STICKERS.find((sticker) => sticker.id === id);
