/**
 * Where a board's notes live.
 *
 * Notes are the board's own text, but they are not part of the scene: they
 * are kept in this browser, in `localStorage`, one entry per board. That is
 * the same place the editor's other per-browser state lives (the assistant's
 * settings, the GIF key, the facilitation store), and it means the notes
 * never travel inside an exported scene or a share link unless the user
 * exports them deliberately.
 *
 * The key is derived from the board id in the url hash — the same
 * `#board=<id>` the dashboard navigates the editor to — so two boards in the
 * same browser keep two separate documents. A standalone editor, which has
 * no board id, uses a single `local` slot.
 */

/** the prefix every board's notes are stored under */
export const NOTES_STORAGE_PREFIX = "mosaic-document-notes:";

/** the slot a board that has no id of its own uses */
export const LOCAL_BOARD_ID = "local";

/** what is stored for one board */
export type StoredNotes = {
  version: 1;
  /** the markdown source */
  notes: string;
};

/**
 * The bits of `Storage` the notes need.
 *
 * Narrowed on purpose: it makes the helpers testable without a real
 * `Storage`, and it documents that nothing else is ever touched.
 */
export type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

/**
 * The browser's `localStorage`, if there is one.
 *
 * It can be missing (server-side rendering, the node build) and it can
 * throw (private browsing, blocked cookies) — neither is worth crashing the
 * editor over, so both are shrugged off.
 */
const getStorage = (): StorageLike | null => {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage;
  } catch {
    return null;
  }
};

/**
 * The board this editor is showing.
 *
 * Read from the hash rather than from a prop because the editor package has
 * no idea what a Mosaic board is: the hash is the one thing both sides
 * already agree on. A hash without a `board` parameter — the standalone
 * editor, a share link — has no board of its own.
 */
export const getBoardId = (): string => {
  try {
    const hash = window.location.hash.replace(/^#/, "");

    if (!hash || !hash.includes("board=")) {
      return LOCAL_BOARD_ID;
    }

    const value = new URLSearchParams(hash).get("board");

    return value && value.length > 0 ? value : LOCAL_BOARD_ID;
  } catch {
    return LOCAL_BOARD_ID;
  }
};

/** the key one board's notes are stored under */
export const notesStorageKey = (boardId: string): string =>
  `${NOTES_STORAGE_PREFIX}${boardId || LOCAL_BOARD_ID}`;

/**
 * The notes as they are stored.
 *
 * Anything that is not the shape written below is treated as no notes at
 * all, so a half-written entry from an older build opens an empty document
 * rather than throwing.
 */
const parseNotes = (raw: string | null): string | null => {
  if (!raw) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const { notes } = parsed as Partial<StoredNotes>;

  return typeof notes === "string" ? notes : null;
};

/**
 * One board's notes, or `null` when it has none yet.
 */
export const loadNotes = (
  boardId: string = getBoardId(),
  storage: StorageLike | null = getStorage(),
): string | null => {
  if (!storage) {
    return null;
  }

  try {
    return parseNotes(storage.getItem(notesStorageKey(boardId)));
  } catch {
    return null;
  }
};

/**
 * Remembers one board's notes.
 *
 * @returns whether they were stored — a full or blocked storage is reported
 * rather than pretended away, so the pane can say the notes are not being
 * kept.
 */
export const saveNotes = (
  notes: string,
  boardId: string = getBoardId(),
  storage: StorageLike | null = getStorage(),
): boolean => {
  if (!storage) {
    return false;
  }

  const record: StoredNotes = { version: 1, notes };

  try {
    storage.setItem(notesStorageKey(boardId), JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
};

/** Forgets one board's notes. */
export const clearNotes = (
  boardId: string = getBoardId(),
  storage: StorageLike | null = getStorage(),
): void => {
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(notesStorageKey(boardId));
  } catch {
    // nothing to do — the notes are gone either way
  }
};
