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

/**
 * Somebody who can be @mentioned in a comment.
 *
 * The candidates are the people the board knows about: the team or board
 * members the host app hands over, the people in the live session, and the
 * people who already commented or left a note on this board.
 */
export type CommentCandidate = {
  /** stable id of the person */
  id: string;
  /** the display name — the name a mention is written with */
  name: string;
  /** avatar image, when the host app has one */
  avatarUrl?: string;
};

/**
 * A person mentioned in a message.
 *
 * Stored with the message so the mention can be rendered as a highlighted
 * token even when the person is no longer around to be picked from the
 * candidate list.
 */
export type CommentMention = {
  id: string;
  name: string;
};

/**
 * An emoji reaction on a message, and the people who left it.
 *
 * One reaction per emoji: the second person to react with the same emoji
 * joins the first one's list instead of adding a second row.
 */
export type CommentReaction = {
  /** the emoji itself */
  emoji: string;
  /** the ids of the users who reacted with it */
  authorIds: string[];
};

export type CommentMessage = {
  id: string;
  author: CommentAuthor;
  text: string;
  /** epoch milliseconds */
  createdAt: number;
  /** the people @mentioned in the text */
  mentions?: CommentMention[];
  /** the emoji reactions on the message */
  reactions?: CommentReaction[];
  /** set once the message has been edited */
  edited?: boolean;
  /** epoch milliseconds of the last edit */
  editedAt?: number;
};

/**
 * Where the thread is pinned.
 *
 * Both variants carry the pin's position in *scene* coordinates so a thread
 * knows where its pin goes even when the element it was dropped on is gone.
 *
 * A thread anchored to an element also carries the pin's offset from the
 * element's centre. The pin is then drawn relative to the element, which
 * makes it follow the element around the canvas — drag the element and the
 * pin comes along, the way a Miro comment does.
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
      /**
       * The pin's offset from the element's centre, in scene units.
       *
       * Absent on threads created before comments could follow an element:
       * such a thread keeps its pin where it was dropped.
       */
      offsetX?: number;
      offsetY?: number;
      /** scene coordinates of the pin when the comment was dropped */
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
