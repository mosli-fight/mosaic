/**
 * The shapes of data the AI assistant works with.
 *
 * There is no built-in AI in Mosaic and no bundled key: the user points the
 * assistant at their own OpenAI-compatible endpoint, and every request goes
 * straight from their browser to that endpoint. Nothing here is ever sent
 * anywhere else.
 */

/** where the user's provider lives, and who they are to it */
export type AISettings = {
  /** the provider's base url, e.g. `https://api.openai.com/v1` */
  baseUrl: string;
  /**
   * the user's own key.
   *
   * it is only ever sent to `baseUrl`, never written into the scene, and
   * never logged.
   */
  apiKey: string;
  /** the model the user wants to talk to, e.g. `gpt-4o-mini` */
  model: string;
};

/** the roles the chat completions API understands */
export type AIChatRole = "system" | "user" | "assistant";

/** a message as the provider sees it */
export type AIChatMessage = {
  role: AIChatRole;
  content: string;
};

/** a message as the panel shows it */
export type AIChatEntry = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** how many elements the answer put on the board */
  insertedElements?: number;
  /** the answer could not be used — the raw text is shown instead */
  isError?: boolean;
};

/** what the panel is doing right now */
export type AIPanelMode = "settings" | "chat";

/** the kinds of element the model is allowed to ask for */
export type AIDiagramElementKind =
  | "rectangle"
  | "ellipse"
  | "diamond"
  | "text"
  | "arrow";

/**
 * A single element the model asked for, in the editor's own terms.
 *
 * The model speaks in plain coordinates (`x`, `y`); the editor speaks in
 * elements. The parser is what turns the former into the latter.
 */
export type AIDiagramElementSpec = {
  kind: AIDiagramElementKind;
  x: number;
  y: number;
  /** the label of a shape, or the content of a text element */
  text: string;
  /** the width of a shape or a text element */
  width?: number;
  /** the height of a shape */
  height?: number;
  /** the other end of an arrow */
  x2?: number;
  y2?: number;
};
