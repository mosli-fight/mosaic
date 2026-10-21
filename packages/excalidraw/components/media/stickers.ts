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
 *
 * The stickers are grouped into categories, the way a shelf of stickers is
 * in real life — faces with faces, animals with animals. The categories are
 * what the panel switches between, and their names are what a search looks
 * at besides the names of the stickers themselves.
 */

import { MIME_TYPES } from "@excalidraw/common";

import type { TranslationKeys } from "../../i18n";
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

export type StickerCategory = {
  id: StickerCategoryId;
  /** the i18n key of the category's name */
  labelKey: TranslationKeys;
  /** other words the category is found by */
  keywords: readonly string[];
};

export const STICKER_CATEGORIES: readonly StickerCategory[] = [
  {
    id: "faces",
    labelKey: "labels.media.stickerCategories.faces",
    keywords: ["face", "emoji", "smiley", "emotion"],
  },
  {
    id: "animals",
    labelKey: "labels.media.stickerCategories.animals",
    keywords: ["animal", "pet", "wild"],
  },
  {
    id: "gestures",
    labelKey: "labels.media.stickerCategories.gestures",
    keywords: ["gesture", "hand", "hands"],
  },
  {
    id: "objects",
    labelKey: "labels.media.stickerCategories.objects",
    keywords: ["object", "thing", "stuff"],
  },
  {
    id: "symbols",
    labelKey: "labels.media.stickerCategories.symbols",
    keywords: ["symbol", "shape", "sign"],
  },
  {
    id: "nature",
    labelKey: "labels.media.stickerCategories.nature",
    keywords: ["nature", "weather", "outdoors"],
  },
  {
    id: "celebration",
    labelKey: "labels.media.stickerCategories.celebration",
    keywords: ["celebration", "celebrate", "party"],
  },
];

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

export const STICKERS: readonly Sticker[] = [
  // ---------------------------------------------------------------- faces
  {
    id: "smiley",
    name: "Smiley",
    category: "faces",
    keywords: ["happy", "joy", "smile"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><circle cx="36" cy="42" r="5" fill="#78350f"/><circle cx="64" cy="42" r="5" fill="#78350f"/><path d="M32 60 Q50 76 68 60" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "wink",
    name: "Wink",
    category: "faces",
    keywords: ["flirt", "smirk"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><circle cx="36" cy="42" r="5" fill="#78350f"/><path d="M56 44 H72" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M34 62 Q50 74 66 62" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "heart-eyes",
    name: "Heart eyes",
    category: "faces",
    keywords: ["love", "crush", "adore"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M36 52 C30 46 24 40 28 34 C31 30 36 32 36 36 C36 32 41 30 44 34 C48 40 42 46 36 52 Z" fill="#ef4444"/><path d="M64 52 C58 46 52 40 56 34 C59 30 64 32 64 36 C64 32 69 30 72 34 C76 40 70 46 64 52 Z" fill="#ef4444"/><path d="M34 66 Q50 76 66 66" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "crying",
    name: "Crying",
    category: "faces",
    keywords: ["sad", "tears", "upset"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><circle cx="36" cy="42" r="5" fill="#78350f"/><circle cx="64" cy="42" r="5" fill="#78350f"/><path d="M34 68 Q50 54 66 68" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M32 52 C28 62 30 70 36 74 C34 66 34 58 32 52 Z" fill="#38bdf8"/><path d="M68 52 C72 62 70 70 64 74 C66 66 66 58 68 52 Z" fill="#38bdf8"/>`,
  },
  {
    id: "laugh",
    name: "Laugh",
    category: "faces",
    keywords: ["haha", "funny", "joy"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M30 40 Q36 32 42 40" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M58 40 Q64 32 70 40" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M28 56 H72 A22 22 0 0 1 28 56 Z" fill="#78350f"/>`,
  },
  {
    id: "cool",
    name: "Cool",
    category: "faces",
    keywords: ["sunglasses", "shades", "chill"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><rect x="16" y="34" width="28" height="16" rx="6" fill="#1f2937"/><rect x="56" y="34" width="28" height="16" rx="6" fill="#1f2937"/><path d="M44 40 H56" stroke="#1f2937" stroke-width="4"/><path d="M36 64 Q50 74 64 64" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "angry",
    name: "Angry",
    category: "faces",
    keywords: ["mad", "furious", "annoyed"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M28 34 L42 42" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><path d="M72 34 L58 42" stroke="#78350f" stroke-width="5" stroke-linecap="round"/><circle cx="36" cy="48" r="5" fill="#78350f"/><circle cx="64" cy="48" r="5" fill="#78350f"/><path d="M34 70 Q50 56 66 70" fill="none" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "thinking",
    name: "Thinking",
    category: "faces",
    keywords: ["hmm", "doubt", "idea"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><circle cx="36" cy="46" r="5" fill="#78350f"/><circle cx="64" cy="46" r="5" fill="#78350f"/><path d="M56 30 Q64 24 72 30" fill="none" stroke="#78350f" stroke-width="4" stroke-linecap="round"/><path d="M40 68 H60" stroke="#78350f" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "surprised",
    name: "Surprised",
    category: "faces",
    keywords: ["wow", "shock", "astonished"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><circle cx="36" cy="40" r="6" fill="#78350f"/><circle cx="64" cy="40" r="6" fill="#78350f"/><ellipse cx="50" cy="66" rx="10" ry="13" fill="#78350f"/>`,
  },
  {
    id: "kiss",
    name: "Kiss",
    category: "faces",
    keywords: ["lips", "love", "smooch"],
    body: `<circle cx="50" cy="50" r="44" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M30 42 q6 -6 12 0" fill="none" stroke="#78350f" stroke-width="4" stroke-linecap="round"/><path d="M58 42 q6 -6 12 0" fill="none" stroke="#78350f" stroke-width="4" stroke-linecap="round"/><path d="M40 64 Q50 58 60 64 Q50 74 40 64 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="2"/>`,
  },

  // -------------------------------------------------------------- animals
  {
    id: "cat",
    name: "Cat",
    category: "animals",
    keywords: ["kitten", "pet", "meow"],
    body: `<path d="M22 40 L26 10 L48 24 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M78 40 L74 10 L52 24 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="56" r="36" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><circle cx="38" cy="50" r="5" fill="#78350f"/><circle cx="62" cy="50" r="5" fill="#78350f"/><path d="M46 62 h8 l-4 5 z" fill="#ec4899"/><path d="M4 56 H24 M4 68 H24 M96 56 H76 M96 68 H76" stroke="#b45309" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "dog",
    name: "Dog",
    category: "animals",
    keywords: ["puppy", "pet", "woof"],
    body: `<ellipse cx="18" cy="52" rx="14" ry="26" fill="#92400e" stroke="#78350f" stroke-width="3"/><ellipse cx="82" cy="52" rx="14" ry="26" fill="#92400e" stroke="#78350f" stroke-width="3"/><circle cx="50" cy="48" r="34" fill="#fcd34d" stroke="#b45309" stroke-width="3"/><circle cx="38" cy="42" r="5" fill="#78350f"/><circle cx="62" cy="42" r="5" fill="#78350f"/><ellipse cx="50" cy="64" rx="12" ry="9" fill="#78350f"/><path d="M50 73 v6" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "panda",
    name: "Panda",
    category: "animals",
    keywords: ["bamboo", "bear", "cute"],
    body: `<circle cx="26" cy="22" r="12" fill="#1f2937"/><circle cx="74" cy="22" r="12" fill="#1f2937"/><circle cx="50" cy="54" r="36" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/><ellipse cx="36" cy="50" rx="10" ry="13" fill="#1f2937" transform="rotate(-20 36 50)"/><ellipse cx="64" cy="50" rx="10" ry="13" fill="#1f2937" transform="rotate(20 64 50)"/><circle cx="36" cy="50" r="4" fill="#f8fafc"/><circle cx="64" cy="50" r="4" fill="#f8fafc"/><ellipse cx="50" cy="68" rx="8" ry="6" fill="#1f2937"/><path d="M42 78 q8 6 16 0" fill="none" stroke="#1f2937" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "fox",
    name: "Fox",
    category: "animals",
    keywords: ["sly", "red"],
    body: `<path d="M22 42 L28 10 L50 30 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/><path d="M78 42 L72 10 L50 30 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="58" r="32" fill="#f97316" stroke="#c2410c" stroke-width="3"/><path d="M50 46 L64 78 L50 90 L36 78 Z" fill="#fff7ed"/><circle cx="38" cy="52" r="5" fill="#78350f"/><circle cx="62" cy="52" r="5" fill="#78350f"/><ellipse cx="50" cy="76" rx="7" ry="5" fill="#78350f"/>`,
  },
  {
    id: "bear",
    name: "Bear",
    category: "animals",
    keywords: ["teddy", "brown", "hug"],
    body: `<circle cx="26" cy="24" r="13" fill="#a16207" stroke="#78350f" stroke-width="3"/><circle cx="74" cy="24" r="13" fill="#a16207" stroke="#78350f" stroke-width="3"/><circle cx="50" cy="54" r="34" fill="#d97706" stroke="#92400e" stroke-width="3"/><circle cx="38" cy="46" r="5" fill="#78350f"/><circle cx="62" cy="46" r="5" fill="#78350f"/><ellipse cx="50" cy="64" rx="16" ry="12" fill="#fcd34d"/><ellipse cx="50" cy="60" rx="7" ry="5" fill="#78350f"/><path d="M42 72 q8 6 16 0" fill="none" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>`,
  },
  {
    id: "bird",
    name: "Bird",
    category: "animals",
    keywords: ["tweet", "chirp", "tweetie"],
    body: `<ellipse cx="44" cy="56" rx="26" ry="30" fill="#38bdf8" stroke="#0369a1" stroke-width="3"/><circle cx="36" cy="42" r="5" fill="#0c4a6e"/><path d="M64 50 L88 58 L64 66 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M38 66 C46 80 62 78 66 66 C56 72 46 70 38 66 Z" fill="#7dd3fc" stroke="#0369a1" stroke-width="2"/><path d="M32 84 v8 M50 84 v8" stroke="#fbbf24" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "fish",
    name: "Fish",
    category: "animals",
    keywords: ["sea", "swim", "ocean"],
    body: `<path d="M14 50 L34 26 L34 74 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/><path d="M30 50 C48 22 76 26 86 50 C76 74 48 78 30 50 Z" fill="#fb923c" stroke="#c2410c" stroke-width="3"/><circle cx="70" cy="44" r="4.5" fill="#7c2d12"/><path d="M52 30 C58 40 58 60 52 70" fill="none" stroke="#c2410c" stroke-width="3"/>`,
  },
  {
    id: "rabbit",
    name: "Rabbit",
    category: "animals",
    keywords: ["bunny", "hop", "easter"],
    body: `<ellipse cx="36" cy="24" rx="9" ry="22" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/><ellipse cx="64" cy="24" rx="9" ry="22" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/><ellipse cx="36" cy="26" rx="4" ry="14" fill="#fecdd3"/><ellipse cx="64" cy="26" rx="4" ry="14" fill="#fecdd3"/><circle cx="50" cy="66" r="30" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/><circle cx="38" cy="60" r="5" fill="#334155"/><circle cx="62" cy="60" r="5" fill="#334155"/><ellipse cx="50" cy="74" rx="6" ry="4.5" fill="#f472b6"/>`,
  },
  {
    id: "frog",
    name: "Frog",
    category: "animals",
    keywords: ["ribbit", "toad", "pond"],
    body: `<circle cx="32" cy="26" r="14" fill="#22c55e" stroke="#15803d" stroke-width="3"/><circle cx="68" cy="26" r="14" fill="#22c55e" stroke="#15803d" stroke-width="3"/><circle cx="32" cy="24" r="6" fill="#f8fafc"/><circle cx="68" cy="24" r="6" fill="#f8fafc"/><circle cx="32" cy="24" r="3" fill="#1f2937"/><circle cx="68" cy="24" r="3" fill="#1f2937"/><path d="M18 66 C18 44 82 44 82 66 C82 88 18 88 18 66 Z" fill="#22c55e" stroke="#15803d" stroke-width="3"/><path d="M32 64 Q50 82 68 64" fill="none" stroke="#15803d" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "butterfly",
    name: "Butterfly",
    category: "animals",
    keywords: ["insect", "wings", "flutter"],
    body: `<path d="M50 50 C34 24 8 26 8 46 C8 66 30 70 50 56 Z" fill="#f472b6" stroke="#db2777" stroke-width="3" stroke-linejoin="round"/><path d="M50 50 C66 24 92 26 92 46 C92 66 70 70 50 56 Z" fill="#f472b6" stroke="#db2777" stroke-width="3" stroke-linejoin="round"/><path d="M50 50 C40 76 26 88 30 78 C34 68 44 62 50 56 Z" fill="#c084fc" stroke="#9333ea" stroke-width="3" stroke-linejoin="round"/><path d="M50 50 C60 76 74 88 70 78 C66 68 56 62 50 56 Z" fill="#c084fc" stroke="#9333ea" stroke-width="3" stroke-linejoin="round"/><rect x="47" y="26" width="6" height="52" rx="3" fill="#78350f"/><path d="M48 30 L38 16 M52 30 L62 16" stroke="#78350f" stroke-width="3" stroke-linecap="round"/>`,
  },

  // ------------------------------------------------------------- gestures
  {
    id: "thumbs-up",
    name: "Thumbs up",
    category: "gestures",
    keywords: ["like", "approve", "yes", "good"],
    body: `<path d="M34 46 C34 40 40 36 48 36 H78 C86 36 90 42 90 50 V80 C90 88 84 92 76 92 H46 C39 92 34 87 34 80 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M44 48 C42 36 42 24 44 16 C46 6 62 6 64 16 C66 24 64 36 62 48 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><rect x="10" y="50" width="22" height="42" rx="8" fill="#d97706" stroke="#b45309" stroke-width="3"/>`,
  },
  {
    id: "thumbs-down",
    name: "Thumbs down",
    category: "gestures",
    keywords: ["dislike", "no", "bad"],
    body: `<path d="M34 46 C34 40 40 36 48 36 H78 C86 36 90 42 90 50 V80 C90 88 84 92 76 92 H46 C39 92 34 87 34 80 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M44 48 C42 36 42 24 44 16 C46 6 62 6 64 16 C66 24 64 36 62 48 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><rect x="10" y="50" width="22" height="42" rx="8" fill="#d97706" stroke="#b45309" stroke-width="3"/>`,
    flip: true,
  },
  {
    id: "ok-hand",
    name: "OK hand",
    category: "gestures",
    keywords: ["perfect", "ring", "fine"],
    body: `<circle cx="34" cy="32" r="15" fill="none" stroke="#b45309" stroke-width="17"/><circle cx="34" cy="32" r="15" fill="none" stroke="#fbbf24" stroke-width="11"/><path d="M48 22 L80 12" fill="none" stroke="#b45309" stroke-width="16" stroke-linecap="round"/><path d="M48 22 L80 12" fill="none" stroke="#fbbf24" stroke-width="10" stroke-linecap="round"/><path d="M50 32 L86 30" fill="none" stroke="#b45309" stroke-width="16" stroke-linecap="round"/><path d="M50 32 L86 30" fill="none" stroke="#fbbf24" stroke-width="10" stroke-linecap="round"/><path d="M48 42 L76 52" fill="none" stroke="#b45309" stroke-width="16" stroke-linecap="round"/><path d="M48 42 L76 52" fill="none" stroke="#fbbf24" stroke-width="10" stroke-linecap="round"/>`,
  },
  {
    id: "wave",
    name: "Wave",
    category: "gestures",
    keywords: ["hello", "hi", "greeting"],
    body: `<path d="M30 92 C22 78 20 62 24 50 L28 26 a6 6 0 0 1 12 0 V8 a6 6 0 0 1 12 0 V24 h2 V6 a6 6 0 0 1 12 0 v22 h2 V14 a6 6 0 0 1 12 0 v40 c0 18 -10 38 -26 38 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M84 22 q6 8 0 16 M94 16 q10 14 0 28" fill="none" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "clap",
    name: "Clap",
    category: "gestures",
    keywords: ["applause", "praise", "bravo"],
    body: `<g transform="rotate(-18 26 62)"><path d="M6 92 C0 78 0 60 6 48 L8 30 a6 6 0 0 1 12 0 V12 a6 6 0 0 1 12 0 V30 h3 V18 a6 6 0 0 1 12 0 v20 h3 V28 a6 6 0 0 1 12 0 v26 c0 22 -12 38 -28 38 Z" transform="translate(-2,0)" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/></g><g transform="translate(100,0) scale(-1,1)"><g transform="rotate(-18 26 62)"><path d="M6 92 C0 78 0 60 6 48 L8 30 a6 6 0 0 1 12 0 V12 a6 6 0 0 1 12 0 V30 h3 V18 a6 6 0 0 1 12 0 v20 h3 V28 a6 6 0 0 1 12 0 v26 c0 22 -12 38 -28 38 Z" transform="translate(-2,0)" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/></g></g><path d="M50 16 L41 25 M50 16 L59 25 M50 30 L37 27 M50 30 L63 27" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "muscle",
    name: "Muscle",
    category: "gestures",
    keywords: ["strong", "flex", "arm", "workout"],
    body: `<path d="M22 90 V62 C22 44 36 32 54 32" fill="none" stroke="#b45309" stroke-width="30" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 90 V62 C22 44 36 32 54 32" fill="none" stroke="#fbbf24" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/><circle cx="64" cy="30" r="16" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M56 22 q8 -4 16 0" fill="none" stroke="#b45309" stroke-width="2.5"/>`,
  },
  {
    id: "love-you",
    name: "Love you",
    category: "gestures",
    keywords: ["iloveyou", "rock", "heart"],
    body: `<g transform="translate(4,2)"><path d="M6 92 C0 78 0 60 6 48 L8 30 a6 6 0 0 1 12 0 V12 a6 6 0 0 1 12 0 V30 h3 V18 a6 6 0 0 1 12 0 v20 h3 V28 a6 6 0 0 1 12 0 v26 c0 22 -12 38 -28 38 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/></g><path d="M52 52 C45 45 36 50 40 57 C43 62 52 70 52 70 C52 70 61 62 64 57 C68 50 59 45 52 52 Z" fill="#f472b6" stroke="#db2777" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "peace",
    name: "Peace",
    category: "gestures",
    keywords: ["victory", "two", "sign"],
    body: `<path d="M32 92 C26 78 26 62 30 50 V30 a6 6 0 0 1 12 0 V6 a6 6 0 0 1 12 0 V26 a6 6 0 0 1 12 0 V52 c0 22 -10 40 -22 40 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "pray",
    name: "Pray",
    category: "gestures",
    keywords: ["thanks", "please", "pray", "hope"],
    body: `<path d="M44 16 C36 32 30 54 30 70 C30 80 35 86 44 86 C53 86 58 80 58 70 C58 54 52 32 44 16 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M56 16 C64 32 70 54 70 70 C70 80 65 86 56 86 C47 86 42 80 42 70 C42 54 48 32 56 16 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M50 20 V84" stroke="#b45309" stroke-width="3"/><path d="M30 62 C22 66 20 76 28 80" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round"/><path d="M70 62 C78 66 80 76 72 80" fill="none" stroke="#b45309" stroke-width="4" stroke-linecap="round"/><rect x="32" y="82" width="36" height="13" rx="5" fill="#fcd34d" stroke="#b45309" stroke-width="3"/>`,
  },
  {
    id: "point-up",
    name: "Point up",
    category: "gestures",
    keywords: ["finger", "up", "above"],
    body: `<path d="M34 92 C28 78 28 62 32 50 V26 a6 6 0 0 1 12 0 V44 h4 V34 a6 6 0 0 1 12 0 v12 h4 V40 a6 6 0 0 1 12 0 v18 c0 20 -10 34 -22 34 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
  },

  // -------------------------------------------------------------- objects
  {
    id: "lightbulb",
    name: "Lightbulb",
    category: "objects",
    keywords: ["idea", "bright", "idea"],
    body: `<path d="M50 8 C32 8 18 22 18 40 C18 52 24 58 28 66 C30 70 31 74 31 78 H69 C69 74 70 70 72 66 C76 58 82 52 82 40 C82 22 68 8 50 8 Z" fill="#facc15" stroke="#a16207" stroke-width="3" stroke-linejoin="round"/><path d="M36 86 H64 M40 94 H60" stroke="#78716c" stroke-width="6" stroke-linecap="round"/><path d="M40 34 C44 24 56 20 62 26" fill="none" stroke="#fef08a" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "rocket",
    name: "Rocket",
    category: "objects",
    keywords: ["space", "launch", "ship"],
    body: `<path d="M50 6 C62 20 68 40 66 62 L58 76 H42 L34 62 C32 40 38 20 50 6 Z" fill="#f1f5f9" stroke="#94a3b8" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="40" r="10" fill="#38bdf8" stroke="#0369a1" stroke-width="3"/><path d="M34 58 L16 74 L22 84 L38 76 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/><path d="M66 58 L84 74 L78 84 L62 76 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/><path d="M42 80 h16 l-8 16 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "coffee",
    name: "Coffee",
    category: "objects",
    keywords: ["cup", "drink", "mug", "cafe"],
    body: `<path d="M22 38 H74 V58 C74 78 62 90 48 90 C34 90 22 78 22 58 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="3" stroke-linejoin="round"/><path d="M74 44 H80 C90 44 92 62 80 62 H74" fill="none" stroke="#94a3b8" stroke-width="3"/><path d="M24 52 H72 V58 C72 76 61 86 48 86 C35 86 24 76 24 58 Z" fill="#6b4423"/><path d="M40 22 c0 -6 8 -6 8 -12 M56 22 c0 -6 8 -6 8 -12" fill="none" stroke="#cbd5e1" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "book",
    name: "Book",
    category: "objects",
    keywords: ["read", "study", "library"],
    body: `<path d="M14 22 C14 16 20 12 26 14 L48 22 V90 L26 82 C20 80 14 84 14 90 Z" fill="#f59e0b" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M86 22 C86 16 80 12 74 14 L52 22 V90 L74 82 C80 80 86 84 86 90 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "gear",
    name: "Gear",
    category: "objects",
    keywords: ["settings", "cog", "options"],
    body: `<g fill="#64748b" stroke="#475569" stroke-width="3" stroke-linejoin="round"><rect x="43" y="2" width="14" height="20" rx="4"/><rect x="43" y="78" width="14" height="20" rx="4"/><rect x="2" y="43" width="20" height="14" rx="4"/><rect x="78" y="43" width="20" height="14" rx="4"/><rect x="43" y="2" width="14" height="20" rx="4" transform="rotate(45 50 50)"/><rect x="43" y="78" width="14" height="20" rx="4" transform="rotate(45 50 50)"/><rect x="2" y="43" width="20" height="14" rx="4" transform="rotate(45 50 50)"/><rect x="78" y="43" width="20" height="14" rx="4" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="30"/></g><circle cx="50" cy="50" r="14" fill="#e2e8f0" stroke="#475569" stroke-width="3"/>`,
  },
  {
    id: "house",
    name: "House",
    category: "objects",
    keywords: ["home", "building", "roof"],
    body: `<path d="M50 8 L92 44 H76 V88 H24 V44 H8 Z" fill="#fcd34d" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><rect x="42" y="58" width="16" height="30" fill="#78350f" stroke="#451a03" stroke-width="3"/><rect x="28" y="52" width="12" height="12" fill="#38bdf8" stroke="#0369a1" stroke-width="2"/><rect x="60" y="52" width="12" height="12" fill="#38bdf8" stroke="#0369a1" stroke-width="2"/>`,
  },
  {
    id: "car",
    name: "Car",
    category: "objects",
    keywords: ["drive", "vehicle", "auto"],
    body: `<path d="M10 68 V58 C10 52 16 48 22 48 H30 L38 30 C40 26 44 24 48 24 H62 C68 24 72 27 74 32 L80 48 C86 48 90 52 90 58 V70 C90 74 88 76 84 76 H16 C12 76 10 74 10 68 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/><path d="M40 48 L44 32 H58 L62 48 Z" fill="#bae6fd" stroke="#0369a1" stroke-width="2"/><circle cx="30" cy="76" r="9" fill="#1f2937"/><circle cx="70" cy="76" r="9" fill="#1f2937"/><circle cx="30" cy="76" r="3.5" fill="#e5e7eb"/><circle cx="70" cy="76" r="3.5" fill="#e5e7eb"/>`,
  },
  {
    id: "umbrella",
    name: "Umbrella",
    category: "objects",
    keywords: ["rain", "weather", "protection"],
    body: `<path d="M6 52 C6 28 26 10 50 10 C74 10 94 28 94 52 C84 44 74 44 66 52 C58 44 50 44 42 52 C34 44 24 44 16 52 C12 50 9 50 6 52 Z" fill="#f43f5e" stroke="#9f1239" stroke-width="3" stroke-linejoin="round"/><path d="M50 10 V84 C50 92 38 92 38 84" fill="none" stroke="#9f1239" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "globe",
    name: "Globe",
    category: "objects",
    keywords: ["world", "earth", "travel", "international"],
    body: `<circle cx="50" cy="50" r="42" fill="#38bdf8" stroke="#0369a1" stroke-width="3"/><ellipse cx="50" cy="50" rx="18" ry="42" fill="none" stroke="#0369a1" stroke-width="3"/><path d="M8 50 H92 M14 28 H86 M14 72 H86" fill="none" stroke="#0369a1" stroke-width="3"/>`,
  },
  {
    id: "key",
    name: "Key",
    category: "objects",
    keywords: ["lock", "unlock", "access", "secret"],
    body: `<circle cx="30" cy="34" r="20" fill="none" stroke="#f59e0b" stroke-width="10"/><circle cx="30" cy="34" r="8" fill="#fbbf24"/><path d="M44 48 L78 82 M64 68 L74 58 M74 78 L84 68" stroke="#f59e0b" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // -------------------------------------------------------------- symbols
  {
    id: "star",
    name: "Star",
    category: "symbols",
    keywords: ["favourite", "rating", "awesome"],
    body: `<path d="M50 6 L61 38 L94 38 L67 57 L78 90 L50 69 L22 90 L33 57 L6 38 L39 38 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "star-outline",
    name: "Outline star",
    category: "symbols",
    keywords: ["favourite", "rating", "awesome"],
    body: `<path d="M50 6 L61 38 L94 38 L67 57 L78 90 L50 69 L22 90 L33 57 L6 38 L39 38 Z" fill="none" stroke="#f59e0b" stroke-width="5" stroke-linejoin="round"/>`,
  },
  {
    id: "sparkles",
    name: "Sparkles",
    category: "symbols",
    keywords: ["magic", "shiny", "new"],
    body: `<path d="M38 8 L45 29 L66 36 L45 43 L38 64 L31 43 L10 36 L31 29 Z" fill="#fbbf24"/><path d="M76 48 L80 62 L94 66 L80 70 L76 84 L72 70 L58 66 L72 62 Z" fill="#f472b6"/><path d="M14 66 L17 76 L27 79 L17 82 L14 92 L11 82 L1 79 L11 76 Z" fill="#38bdf8"/>`,
  },
  {
    id: "heart",
    name: "Heart",
    category: "symbols",
    keywords: ["love", "like", "favourite"],
    body: `<path d="M50 90 C50 90 6 60 6 33 C6 17 19 6 32 6 C41 6 47 11 50 17 C53 11 59 6 68 6 C81 6 94 17 94 33 C94 60 50 90 50 90 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "heart-outline",
    name: "Outline heart",
    category: "symbols",
    keywords: ["love", "like", "favourite"],
    body: `<path d="M50 90 C50 90 6 60 6 33 C6 17 19 6 32 6 C41 6 47 11 50 17 C53 11 59 6 68 6 C81 6 94 17 94 33 C94 60 50 90 50 90 Z" fill="none" stroke="#ef4444" stroke-width="5" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-right",
    name: "Arrow",
    category: "symbols",
    keywords: ["direction", "next", "forward"],
    body: `<path d="M6 36 H56 V14 L94 50 L56 86 V64 H6 Z" fill="#3b82f6" stroke="#1d4ed8" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-up",
    name: "Arrow up",
    category: "symbols",
    keywords: ["direction", "up", "north"],
    body: `<path d="M50 6 L86 44 H64 V94 H36 V44 H14 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "arrow-down",
    name: "Arrow down",
    category: "symbols",
    keywords: ["direction", "down", "south"],
    body: `<path d="M50 94 L14 56 H36 V6 H64 V56 H86 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/>`,
  },
  {
    id: "check-circle",
    name: "Check",
    category: "symbols",
    keywords: ["done", "tick", "yes", "ok"],
    body: `<circle cx="50" cy="50" r="44" fill="#22c55e" stroke="#15803d" stroke-width="3"/><path d="M28 51 L44 67 L73 33" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },
  {
    id: "check-badge",
    name: "Check badge",
    category: "symbols",
    keywords: ["done", "tick", "approved"],
    body: `<rect x="8" y="8" width="84" height="84" rx="24" fill="#6366f1" stroke="#4338ca" stroke-width="3"/><path d="M30 51 L44 65 L71 35" fill="none" stroke="#ffffff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>`,
  },

  // --------------------------------------------------------------- nature
  {
    id: "fire",
    name: "Fire",
    category: "nature",
    keywords: ["hot", "flame", "burn", "lit"],
    body: `<path d="M50 6 C59 24 74 31 74 53 A24 24 0 0 1 26 53 C26 42 33 35 40 29 C40 40 44 45 49 47 C44 34 46 18 50 6 Z" fill="#f97316" stroke="#c2410c" stroke-width="3" stroke-linejoin="round"/><path d="M50 44 C56 51 61 56 61 63 A11 11 0 0 1 39 63 C39 56 45 50 50 44 Z" fill="#fbbf24"/>`,
  },
  {
    id: "sun",
    name: "Sun",
    category: "nature",
    keywords: ["sunny", "weather", "day", "light"],
    body: `<circle cx="50" cy="50" r="24" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M50 4 V16 M50 84 V96 M4 50 H16 M84 50 H96 M17 17 L26 26 M74 74 L83 83 M83 17 L74 26 M26 74 L17 83" stroke="#f59e0b" stroke-width="6" stroke-linecap="round"/>`,
  },
  {
    id: "rainbow",
    name: "Rainbow",
    category: "nature",
    keywords: ["sky", "weather", "pride", "hope"],
    body: `<path d="M10 84 A40 40 0 0 1 90 84" fill="none" stroke="#ef4444" stroke-width="12" stroke-linecap="round"/><path d="M22 84 A28 28 0 0 1 78 84" fill="none" stroke="#fbbf24" stroke-width="11" stroke-linecap="round"/><path d="M34 84 A16 16 0 0 1 66 84" fill="none" stroke="#22c55e" stroke-width="10" stroke-linecap="round"/><ellipse cx="16" cy="86" rx="14" ry="9" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/><ellipse cx="84" cy="86" rx="14" ry="9" fill="#f8fafc" stroke="#cbd5e1" stroke-width="3"/>`,
  },
  {
    id: "leaf",
    name: "Leaf",
    category: "nature",
    keywords: ["plant", "green", "growth", "eco"],
    body: `<path d="M84 16 C50 16 20 30 16 60 C12 82 30 92 50 88 C74 83 88 58 84 16 Z" fill="#22c55e" stroke="#15803d" stroke-width="3" stroke-linejoin="round"/><path d="M84 16 C64 34 40 58 22 88" fill="none" stroke="#15803d" stroke-width="3"/>`,
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "nature",
    keywords: ["winter", "cold", "frozen", "ice"],
    body: `<path d="M50 6 V94 M12 28 L88 72 M88 28 L12 72" stroke="#38bdf8" stroke-width="6" stroke-linecap="round"/><path d="M50 6 L42 14 M50 6 L58 14 M50 94 L42 86 M50 94 L58 86" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "flower",
    name: "Flower",
    category: "nature",
    keywords: ["blossom", "spring", "garden"],
    body: `<g fill="#f472b6"><circle cx="50" cy="26" r="16"/><circle cx="72" cy="42" r="16"/><circle cx="64" cy="68" r="16"/><circle cx="36" cy="68" r="16"/><circle cx="28" cy="42" r="16"/></g><circle cx="50" cy="47" r="14" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M50 61 V94" stroke="#15803d" stroke-width="5" stroke-linecap="round"/>`,
  },

  // ---------------------------------------------------------- celebration
  {
    id: "medal",
    name: "Medal",
    category: "celebration",
    keywords: ["award", "winner", "prize", "gold"],
    body: `<path d="M30 58 L22 96 L42 87 L50 97 L58 87 L78 96 L70 58 Z" fill="#ef4444" stroke="#b91c1c" stroke-width="3" stroke-linejoin="round"/><circle cx="50" cy="40" r="28" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M50 26 L53.5 35.2 L63.3 35.7 L55.7 41.9 L58.2 51.3 L50 46 L41.8 51.3 L44.3 41.9 L36.7 35.7 L46.5 35.2 Z" fill="#b45309"/>`,
  },
  {
    id: "rosette",
    name: "Rosette",
    category: "celebration",
    keywords: ["award", "ribbon", "prize"],
    body: `<g fill="#ec4899"><circle cx="50" cy="18" r="11"/><circle cx="76" cy="26" r="11"/><circle cx="88" cy="50" r="11"/><circle cx="76" cy="74" r="11"/><circle cx="50" cy="82" r="11"/><circle cx="24" cy="74" r="11"/><circle cx="12" cy="50" r="11"/><circle cx="24" cy="26" r="11"/><circle cx="50" cy="50" r="36"/></g><path d="M50 30 L55 43.1 L69 43.8 L58.1 52.6 L61.8 66.2 L50 58.5 L38.2 66.2 L41.9 52.6 L31 43.8 L45 43.1 Z" fill="#ffffff"/>`,
  },
  {
    id: "party-popper",
    name: "Party popper",
    category: "celebration",
    keywords: ["confetti", "party", "celebrate"],
    body: `<path d="M18 86 L46 22 L78 54 Z" fill="#a855f7" stroke="#7e22ce" stroke-width="3" stroke-linejoin="round"/><path d="M32 60 L60 32" stroke="#e9d5ff" stroke-width="4"/><circle cx="24" cy="24" r="5" fill="#f472b6"/><circle cx="46" cy="10" r="4" fill="#38bdf8"/><circle cx="66" cy="14" r="5" fill="#fbbf24"/><circle cx="84" cy="30" r="4" fill="#ef4444"/><path d="M14 40 l6 2 M30 12 l4 6 M78 4 l2 6" stroke="#f472b6" stroke-width="4" stroke-linecap="round"/>`,
  },
  {
    id: "confetti",
    name: "Confetti",
    category: "celebration",
    keywords: ["party", "celebrate", "streamers"],
    body: `<circle cx="22" cy="24" r="6" fill="#ef4444"/><rect x="52" y="12" width="10" height="10" rx="2" fill="#38bdf8" transform="rotate(20 57 17)"/><path d="M76 30 l8 6 M40 44 l10 -4" stroke="#fbbf24" stroke-width="5" stroke-linecap="round"/><circle cx="30" cy="62" r="5" fill="#22c55e"/><rect x="56" y="60" width="10" height="10" rx="2" fill="#a855f7" transform="rotate(-15 61 65)"/><path d="M16 84 l10 4 M78 78 l6 8" stroke="#f472b6" stroke-width="5" stroke-linecap="round"/><path d="M44 74 q8 -10 16 0" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/>`,
  },
  {
    id: "cake",
    name: "Cake",
    category: "celebration",
    keywords: ["birthday", "party", "sweet", "candles"],
    body: `<rect x="18" y="56" width="64" height="34" rx="4" fill="#fcd34d" stroke="#b45309" stroke-width="3"/><path d="M18 56 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0 q8 -12 16 0" fill="none" stroke="#f472b6" stroke-width="8" stroke-linecap="round"/><path d="M18 70 H82" stroke="#f472b6" stroke-width="6"/><path d="M50 50 V34" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M50 34 c7 -7 0 -11 0 -18 c0 7 -7 11 0 18 Z" fill="#fbbf24" stroke="#b45309" stroke-width="2"/>`,
  },
  {
    id: "balloon",
    name: "Balloon",
    category: "celebration",
    keywords: ["party", "birthday", "inflate"],
    body: `<ellipse cx="50" cy="40" rx="26" ry="30" fill="#ef4444" stroke="#b91c1c" stroke-width="3"/><path d="M42 68 h16 l-8 8 Z" fill="#b91c1c"/><path d="M50 76 q10 10 0 18" fill="none" stroke="#b91c1c" stroke-width="3"/><ellipse cx="40" cy="30" rx="6" ry="8" fill="#fca5a5" opacity="0.7"/>`,
  },
  {
    id: "trophy",
    name: "Trophy",
    category: "celebration",
    keywords: ["award", "winner", "champion", "cup"],
    body: `<path d="M28 12 H72 V38 C72 54 62 64 50 64 C38 64 28 54 28 38 Z" fill="#fbbf24" stroke="#b45309" stroke-width="3" stroke-linejoin="round"/><path d="M28 20 H16 C16 34 22 40 30 40 M72 20 H84 C84 34 78 40 70 40" fill="none" stroke="#b45309" stroke-width="3"/><rect x="44" y="64" width="12" height="16" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><rect x="32" y="80" width="36" height="10" rx="3" fill="#b45309"/>`,
  },
  {
    id: "fireworks",
    name: "Fireworks",
    category: "celebration",
    keywords: ["celebrate", "night", "new year", "burst"],
    body: `<circle cx="50" cy="50" r="8" fill="#fbbf24" stroke="#b45309" stroke-width="3"/><path d="M50 6 V28 M50 72 V94 M6 50 H28 M72 50 H94 M18 18 L34 34 M66 66 L82 82 M82 18 L66 34 M34 66 L18 82" stroke="#f472b6" stroke-width="6" stroke-linecap="round"/><path d="M32 4 L28 18 M68 4 L72 18 M4 32 L18 28" stroke="#38bdf8" stroke-width="4" stroke-linecap="round"/>`,
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

/** a category and the stickers of it that matched a search */
export type StickerGroup = {
  category: StickerCategory;
  stickers: Sticker[];
};

/**
 * Whether a word answers to what the user is looking for.
 *
 * The match goes both ways for a single word, so that "cat" finds the
 * sticker named "Cat" and "cats" finds it as well. A search of several
 * words is only matched the other way round — the plain way round is
 * enough for it, and the other way round would let a word inside the
 * search match on its own ("nothing at all" would find the "thing"
 * inside it).
 */
const contains = (haystack: string, needle: string) => {
  if (haystack.includes(needle)) {
    return true;
  }

  if (needle.includes(" ") || haystack.length < 3) {
    return false;
  }

  return needle.includes(haystack);
};

/**
 * Whether a sticker answers to what the user is looking for.
 *
 * A sticker answers to its own name, to the words it is filed under and to
 * the name of its category — typing "cat" finds the cat, typing "love"
 * finds the hearts.
 */
const matches = (sticker: Sticker, needle: string) => {
  if (contains(sticker.name.toLowerCase(), needle)) {
    return true;
  }

  if (sticker.keywords?.some((keyword) => contains(keyword, needle))) {
    return true;
  }

  const category = STICKER_CATEGORIES.find(
    (entry) => entry.id === sticker.category,
  );

  if (!category) {
    return false;
  }

  return (
    contains(category.id, needle) ||
    category.keywords.some((keyword) => contains(keyword, needle))
  );
};

/**
 * The stickers matching a search, grouped by the category they belong to.
 *
 * An empty search returns every category in full. A category can be named,
 * in which case only that category is looked at; without one, the search
 * is looked at across every category. Categories that end up with nothing
 * in them are dropped, so the panel never shows an empty heading.
 */
export const searchStickers = (
  query: string,
  category?: StickerCategoryId,
): StickerGroup[] => {
  const trimmed = query.trim();
  const needle = trimmed.toLowerCase();

  const categories = category
    ? STICKER_CATEGORIES.filter((entry) => entry.id === category)
    : STICKER_CATEGORIES;

  return categories.reduce<StickerGroup[]>((groups, entry) => {
    const stickers = STICKERS.filter(
      (sticker) =>
        sticker.category === entry.id && (!needle || matches(sticker, needle)),
    );

    if (stickers.length) {
      groups.push({ category: entry, stickers });
    }

    return groups;
  }, []);
};

/** how many stickers the panel offers in total */
export const getStickerCount = () => STICKERS.length;
