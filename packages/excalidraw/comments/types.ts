/**
 * Mosaic comments.
 *
 * A comment is a *thread*: a pin anchored to the canvas (a free point, or an
 * element) holding one or more messages. The thread is the unit that gets
 * resolved, hidden and listed in the comments panel; the messages are the
 * individual notes inside it.
 *
 * Threads live in `appState.commentThreads` so they ride along with the rest
 * of the scene (localStorage, `.excalidraw` files, Mosaic boards).
 */

/** who wrote a message */
export type CommentAuthor = {
  /** stable id — the collaborator's socket id, or a locally generated one */
  id: string;
  /** display name; may be empty when the editor doesn't know the user */
  name: string;
  /** avatar image, when the host app has one */
  avatarUrl?: string;
  /** accent color used for the pin and the author chip */
  color?: string;
};

export type CommentMessage = {
  id: string;
  author: CommentAuthor;
  text: string;
  /** epoch milliseconds */
  createdAt: number;
};

/**
 * Where the thread is pinned.
 *
 * Both variants carry the pin's position in *scene* coordinates so a thread
 * anchored to an element still knows where its pin goes (and where to put
 * the popover) even if the element is later moved — the pin is a fixed
 * point on the canvas, exactly like in Miro.
 */
export type CommentAnchor =
  | {
      type: "point";
      /** scene coordinates */
      x: number;
      y: number;
    }
  | {
      type: "element";
      /** id of the element the comment was dropped on */
      elementId: string;
      /** scene coordinates of the pin */
      x: number;
      y: number;
    };

export type CommentThread = {
  id: string;
  anchor: CommentAnchor;
  messages: CommentMessage[];
  /** a resolved thread is archived — hidden from the canvas by default */
  resolved: boolean;
  /** epoch milliseconds */
  createdAt: number;
  /** epoch milliseconds of the last message */
  updatedAt: number;
};

/**
 * Where the composer is about to open. Set when the user drops a pin with
 * the comment tool; the composer renders at these scene coordinates.
 */
export type CommentComposerAnchor = {
  /** scene coordinates */
  x: number;
  y: number;
  /** element the comment was dropped on, if any */
  elementId: string | null;
};

/** the filter applied to the list of threads in the comments panel */
export type CommentFilter = "all" | "open" | "resolved";
