import { describe, expect, it, vi } from "vitest";

import {
  clearNotes,
  getBoardId,
  LOCAL_BOARD_ID,
  loadNotes,
  notesStorageKey,
  NOTES_STORAGE_PREFIX,
  saveNotes,
} from "../components/document/notesStorage";

import type { StorageLike } from "../components/document/notesStorage";

/**
 * Where the notes are kept.
 *
 * The store is what makes the pane's promise true — that the notes are still
 * there when the board is reopened — so it is tested on its own, against a
 * fake `Storage` rather than a real one. The board id comes from the url
 * hash, which is the only thing the editor and the dashboard already agree
 * on, so that is faked too.
 */

/** a `Storage` that only remembers what it is told, and can be made to fail */
const makeStorage = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));

  const storage: StorageLike & { data: Map<string, string> } = {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };

  return storage;
};

/** puts a board id in the url hash, the way the dashboard does */
const setHash = (hash: string) => {
  window.location.hash = hash;
};

describe("getBoardId", () => {
  it("reads the board id out of the hash", () => {
    setHash("#board=abc123");
    expect(getBoardId()).toBe("abc123");
  });

  it("reads it when the hash carries more than the board", () => {
    setHash("#board=abc123&scene=whatever");
    expect(getBoardId()).toBe("abc123");
  });

  it("falls back to the local slot without a board", () => {
    setHash("");
    expect(getBoardId()).toBe(LOCAL_BOARD_ID);

    setHash("#json=something");
    expect(getBoardId()).toBe(LOCAL_BOARD_ID);
  });

  it("falls back to the local slot for an empty board id", () => {
    setHash("#board=");
    expect(getBoardId()).toBe(LOCAL_BOARD_ID);
  });
});

describe("notes storage", () => {
  it("keys one entry per board", () => {
    expect(notesStorageKey("abc")).toBe(`${NOTES_STORAGE_PREFIX}abc`);
    expect(notesStorageKey("abc")).not.toBe(notesStorageKey("def"));
  });

  it("has no notes for a board that was never written", () => {
    expect(loadNotes("abc", makeStorage())).toBe(null);
  });

  it("round-trips the notes", () => {
    const storage = makeStorage();

    expect(saveNotes("# hello", "abc", storage)).toBe(true);
    expect(loadNotes("abc", storage)).toBe("# hello");
  });

  it("keeps two boards' notes apart", () => {
    const storage = makeStorage();

    saveNotes("board one", "one", storage);
    saveNotes("board two", "two", storage);

    expect(loadNotes("one", storage)).toBe("board one");
    expect(loadNotes("two", storage)).toBe("board two");
  });

  it("overwrites rather than appends", () => {
    const storage = makeStorage();

    saveNotes("first", "abc", storage);
    saveNotes("second", "abc", storage);

    expect(loadNotes("abc", storage)).toBe("second");
  });

  it("stores an empty document as an empty document", () => {
    const storage = makeStorage();

    saveNotes("", "abc", storage);

    // not `null`: the board has notes, they are just empty
    expect(loadNotes("abc", storage)).toBe("");
  });

  it("treats a corrupt entry as no notes", () => {
    const storage = makeStorage({
      [notesStorageKey("abc")]: "{not json",
    });

    expect(loadNotes("abc", storage)).toBe(null);
  });

  it("treats an entry of the wrong shape as no notes", () => {
    const storage = makeStorage({
      [notesStorageKey("abc")]: JSON.stringify({ version: 1, notes: 42 }),
    });

    expect(loadNotes("abc", storage)).toBe(null);
  });

  it("forgets one board's notes and no other", () => {
    const storage = makeStorage();

    saveNotes("one", "one", storage);
    saveNotes("two", "two", storage);
    clearNotes("one", storage);

    expect(loadNotes("one", storage)).toBe(null);
    expect(loadNotes("two", storage)).toBe("two");
  });

  it("reports a write it could not make", () => {
    const storage = makeStorage();
    storage.setItem = vi.fn(() => {
      throw new Error("quota exceeded");
    });

    expect(saveNotes("notes", "abc", storage)).toBe(false);
  });

  it("survives a storage that throws on read", () => {
    const storage = makeStorage();
    storage.getItem = vi.fn(() => {
      throw new Error("blocked");
    });

    expect(loadNotes("abc", storage)).toBe(null);
  });

  it("survives having no storage at all", () => {
    expect(loadNotes("abc", null)).toBe(null);
    expect(saveNotes("notes", "abc", null)).toBe(false);
    expect(() => clearNotes("abc", null)).not.toThrow();
  });

  it("defaults to the board in the url", () => {
    setHash("#board=from-hash");
    const storage = makeStorage();

    saveNotes("in the hash", undefined, storage);

    expect(loadNotes("from-hash", storage)).toBe("in the hash");
  });
});
