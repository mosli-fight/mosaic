/**
 * What the model is told, and what the board is told about itself.
 *
 * The board summary is the only thing Mosaic ever tells the model about the
 * user's work, and it is deliberately compact: the types of the elements and
 * the text on them. Nothing else about the scene leaves the browser.
 */

import { arrayToMap } from "@excalidraw/common";
import { getBoundTextElement, isTextElement } from "@excalidraw/element";

import type { ExcalidrawElement } from "@excalidraw/element/types";

import type { AIChatMessage } from "./types";

/** how many pieces of text the summary lists at most */
const MAX_LISTED_TEXTS = 80;

/** the names the types are known by in the summary */
const TYPE_NAMES: Record<string, string> = {
  rectangle: "rectangles",
  diamond: "diamonds",
  ellipse: "ellipses",
  arrow: "arrows",
  line: "lines",
  text: "texts",
  freedraw: "drawings",
  image: "images",
  frame: "frames",
  embeddable: "embeds",
  iframe: "iframes",
  magicframe: "wireframes",
  selection: "selections",
  stickynote: "sticky notes",
};

/**
 * A compact description of the board: what is on it, and what it says.
 *
 * @returns the summary, or an empty string when the board is empty
 */
export const buildBoardSummary = (
  elements: readonly ExcalidrawElement[],
): string => {
  if (!elements.length) {
    return "";
  }

  const elementsMap = arrayToMap(elements);

  const counts = new Map<string, number>();
  const texts: string[] = [];

  for (const element of elements) {
    counts.set(element.type, (counts.get(element.type) ?? 0) + 1);

    const text = isTextElement(element)
      ? element.text
      : getBoundTextElement(element, elementsMap)?.text;

    if (text && text.trim()) {
      texts.push(text.trim());
    }
  }

  const kinds = [...counts.entries()]
    .map(([type, count]) => {
      const name = TYPE_NAMES[type] ?? `${type}s`;
      return `${count} ${name}`;
    })
    .join(", ");

  const lines = [`${elements.length} elements on the board: ${kinds}.`];

  if (texts.length) {
    lines.push("Text on the board:");
    for (const text of texts.slice(0, MAX_LISTED_TEXTS)) {
      lines.push(`- ${JSON.stringify(text)}`);
    }
    if (texts.length > MAX_LISTED_TEXTS) {
      lines.push(`- ... and ${texts.length - MAX_LISTED_TEXTS} more`);
    }
  }

  return lines.join("\n");
};

/** what the assistant is told about itself */
const ASSISTANT_PROMPT = [
  "You are the AI assistant of Mosaic, a whiteboard editor.",
  "You are talking to someone who is looking at a board.",
  "Answer in plain text. Keep it short unless you are asked for detail.",
].join("\n");

/** the instructions for a board summary */
const SUMMARY_PROMPT = [
  "Describe the board the person is looking at.",
  "Say what it shows, what its parts are, and what it looks like it is for.",
  "A few short sentences, no lists, no preamble.",
].join(" ");

/**
 * The instructions for a diagram.
 *
 * The model is asked for nothing but a json array, because anything else
 * would have to be guessed at. The parser is forgiving about the details,
 * but it can only work with what it is given.
 */
const DIAGRAM_PROMPT = [
  "You draw diagrams for the Mosaic whiteboard editor.",
  "Answer with a single JSON array and nothing else: no prose, no markdown, no code fences.",
  "Every item of the array is an object with:",
  '"type": "rectangle" | "ellipse" | "diamond" | "text" | "arrow"',
  '"x" and "y": numbers, the position of the element on the board',
  '"text": a string, the label of a shape or the content of a text element',
  '"width" and "height": numbers, the size of a shape (optional)',
  '"x2" and "y2": numbers, the other end of an arrow (arrows only)',
  "Example:",
  '[{"type":"rectangle","x":0,"y":0,"width":160,"height":80,"text":"Start"},' +
    '{"type":"arrow","x":80,"y":40,"x2":80,"y2":160},' +
    '{"type":"ellipse","x":0,"y":160,"width":160,"height":80,"text":"End"}]',
].join("\n");

/** the board context, as it is handed to the model */
const withBoardContext = (prompt: string, boardSummary: string): string =>
  boardSummary
    ? `${prompt}\n\nHere is the board the person is looking at:\n${boardSummary}`
    : prompt;

/**
 * The messages of a plain chat turn.
 *
 * @param history what was said before
 * @param userText what the person just asked
 * @param boardSummary the board, when the person wants the model to see it
 */
export const buildChatMessages = ({
  history,
  userText,
  boardSummary,
}: {
  history: AIChatMessage[];
  userText: string;
  boardSummary: string;
}): AIChatMessage[] => [
  { role: "system", content: withBoardContext(ASSISTANT_PROMPT, boardSummary) },
  ...history,
  { role: "user", content: userText },
];

/**
 * The messages that ask for a summary of the board.
 *
 * The board is always part of this one: without it there is nothing to
 * summarize.
 */
export const buildSummaryMessages = ({
  boardSummary,
}: {
  boardSummary: string;
}): AIChatMessage[] => [
  { role: "system", content: withBoardContext(SUMMARY_PROMPT, boardSummary) },
  {
    role: "user",
    content: "Summarize this board.",
  },
];

/**
 * The messages that ask for a diagram.
 *
 * @param prompt what the person wants drawn
 * @param boardSummary the board, when the person wants the model to see it
 */
export const buildDiagramMessages = ({
  prompt,
  boardSummary,
}: {
  prompt: string;
  boardSummary: string;
}): AIChatMessage[] => [
  { role: "system", content: withBoardContext(DIAGRAM_PROMPT, boardSummary) },
  { role: "user", content: prompt },
];
