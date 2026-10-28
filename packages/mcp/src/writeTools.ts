/**
 * The write tool bodies, as plain functions over a database handle.
 *
 * Same arrangement as `tools.ts`: no MCP types here, so everything worth
 * testing — scoping, the version guard, the size cap, the input checks — runs
 * against a fake database with no transport involved. `index.ts` is the only
 * place that knows a tool exists.
 *
 * ## What every write here shares
 *
 * - **The owner is never an argument.** It comes from the configured identity,
 *   and every statement takes its `WHERE` from `boardScope`. A caller cannot
 *   name a board it does not own: the row simply does not match.
 * - **A scene write carries a version.** `expectedSceneVersion` is required, and
 *   a mismatch fails the call with a message that says what the current version
 *   is. There is no "force" flag, because the only caller that wants one is a
 *   caller that is about to destroy someone's work.
 * - **A scene write is size-checked before it is sent.** The cap is the same
 *   `maxSceneBytes` the read path uses to decide what it will parse; a scene
 *   this server would refuse to read is one it must not write either.
 */

import {
  getStickyNoteLayout,
  newElementWith,
  refreshTextDimensions,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
} from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import { toBoardMeta } from "./db.js";
import {
  buildElements,
  findElement,
  readScene,
  writeScene,
} from "./sceneEdit.js";
import { ToolError } from "./tools.js";
import {
  folderOwned,
  insertBoard,
  loadBoardForWrite,
  logActivity,
  renameBoardRow,
  updateScene,
} from "./writes.js";

import type { OwnerIdentity, ServerOptions } from "./config.js";
import type { BoardMeta, Database } from "./db.js";
import type {
  AddElementToolInput,
  CreateBoardInput,
  DeleteElementInput,
  DuplicateBoardInput,
  MoveElementInput,
  RenameBoardInput,
  UpdateElementInput,
} from "./schemas.js";

/** What `create_board` and `duplicate_board` return. */
export type BoardWriteResult = {
  board: BoardMeta;
  /** A sentence a model can repeat to the person, e.g. "Created ...". */
  message: string;
};

/** The name a board gets when the caller does not supply one. */
export const DEFAULT_BOARD_NAME = "Untitled board";

/**
 * The name a duplicate gets.
 *
 * Matches `duplicateBoard` in both the API and the IndexedDB adapter, so a
 * board copied from a model is indistinguishable from one copied in the
 * dashboard.
 */
export const copyName = (name: string): string => `${name} (copy)`;

/**
 * Creates a board for the configured owner.
 *
 * `folderId` is checked against the caller's own folders before the insert.
 * The foreign key alone would happily accept another owner's folder uuid, and
 * the board would then appear in a sidebar it does not belong to — which is a
 * leak of the folder's name, not just a mis-filing.
 */
export const runCreateBoard = async (
  db: Database,
  owner: OwnerIdentity,
  input: CreateBoardInput,
): Promise<BoardWriteResult> => {
  const name = input.name ?? DEFAULT_BOARD_NAME;
  const folderId = input.folderId ?? null;

  if (folderId !== null && !(await folderOwned(db, owner, folderId))) {
    throw new ToolError(
      `No folder with id ${folderId} is visible to this server. It may not ` +
        "exist, or it may belong to another owner.",
    );
  }

  const row = await insertBoard(db, owner, { name, folderId });

  // The activity row is what the dashboard's per-board chip counts. Written
  // after the insert so a failed create cannot leave a phantom event.
  await logActivity(db, owner, row.id, "create");

  return {
    board: toBoardMeta(row),
    message: `Created board "${row.name}" (${row.id}).`,
  };
};

/**
 * Renames a board.
 *
 * No scene version is required: a rename does not touch the scene, so it cannot
 * clobber one, and requiring a version would make a rename fail for a reason
 * unrelated to what it changes. When the caller *does* pass one it is honoured,
 * so a model working from a stale listing is told rather than ignored.
 */
export const runRenameBoard = async (
  db: Database,
  owner: OwnerIdentity,
  input: RenameBoardInput,
): Promise<BoardWriteResult> => {
  const { row, conflict } = await renameBoardRow(db, owner, {
    boardId: input.boardId,
    name: input.name,
    expectedSceneVersion: input.expectedSceneVersion,
  });

  if (!row) {
    if (conflict) {
      // The board is the caller's, so the only reason the update matched
      // nothing is the version guard. Saying which version is current is what
      // lets the model retry correctly instead of guessing.
      throw new ToolError(
        `Board ${input.boardId} is at scene_version ${conflict.scene_version}, ` +
          `but the rename expected ${input.expectedSceneVersion}. Nothing was ` +
          "changed. Re-read the board and try again.",
      );
    }
    throw new ToolError(
      `No board with id ${input.boardId} is visible to this server. It may ` +
        "not exist, or it may belong to another owner.",
    );
  }

  await logActivity(db, owner, row.id, "rename", row.name);

  return {
    board: toBoardMeta(row),
    message: `Renamed board ${row.id} to "${row.name}".`,
  };
};

/**
 * Copies a board, scene included.
 *
 * The source is read under the caller's scope — a board that is not theirs is
 * reported as missing, exactly as `get_board` does — and the copy is inserted
 * as a new row with a new id. The copy is unfiled and unfavourited, matching
 * the dashboard: duplicating should not silently clone organisational
 * decisions.
 *
 * `scene_version` on the copy starts at 0 (the column's default), which is
 * correct: it is a new row with no editing history, and a caller that wants to
 * edit it reads it first.
 */
export const runDuplicateBoard = async (
  db: Database,
  owner: OwnerIdentity,
  input: DuplicateBoardInput,
): Promise<BoardWriteResult> => {
  const source = await loadBoardForWrite(db, owner, input.boardId);
  if (!source) {
    throw new ToolError(
      `No board with id ${input.boardId} is visible to this server. It may ` +
        "not exist, or it may belong to another owner.",
    );
  }

  const name = input.name ?? copyName(source.name);

  const row = await insertBoard(db, owner, {
    name,
    folderId: null,
    scene: source.scene,
    sceneBytes: source.scene_bytes,
  });

  await logActivity(db, owner, row.id, "create");

  return {
    board: toBoardMeta(row),
    message:
      `Duplicated board ${source.id} as "${row.name}" (${row.id}), ` +
      `with ${source.scene_bytes ?? 0} bytes of scene.`,
  };
};

/**
 * Refuses a scene that would exceed the configured cap.
 *
 * Checked before the write, on the serialised string, because the point is to
 * never send it: a guard applied after the `UPDATE` would already have replaced
 * the scene. The cap is the read path's `maxSceneBytes`, so the server cannot
 * write a board it would then refuse to summarise.
 */
export const assertSceneFits = (
  scene: string,
  options: ServerOptions,
  action: string,
): number => {
  const bytes = Buffer.byteLength(scene, "utf8");
  if (bytes > options.maxSceneBytes) {
    throw new ToolError(
      `Refusing to ${action}: the resulting scene would be ${bytes} bytes, ` +
        `above the ${options.maxSceneBytes}-byte cap ` +
        "(MOSAIC_MCP_MAX_SCENE_BYTES). Nothing was written.",
    );
  }
  return bytes;
};

// ---------------------------------------------------------------------------
// Element tools
// ---------------------------------------------------------------------------

/**
 * What an element write returns.
 *
 * The board metadata is included so a caller can see the new `sceneVersion`
 * without a second call — every element write bumps it, and the next write
 * needs the value it produced. `elementIds` names what was created, which is
 * the only way to refer to an element afterwards.
 */
export type ElementWriteResult = {
  board: BoardMeta;
  /** Ids of the elements this call created or changed. */
  elementIds: string[];
  message: string;
};

/**
 * The shared read-modify-write for every element tool.
 *
 * The four steps are the whole safety story, and they are in this order for a
 * reason:
 *
 * 1. **Read the board under the owner's scope.** A board that is not the
 *    caller's is reported as missing, exactly as `get_board` does — never as
 *    forbidden, which would confirm it exists.
 * 2. **Refuse a stale version before touching anything.** The version the
 *    caller edited is compared with the stored one here, so a stale write does
 *    not even build elements. `updateScene` checks again in its `WHERE`, which
 *    is what closes the window between this read and the write; this check
 *    exists to produce a good error, not to be the guarantee.
 * 3. **Apply the change and size-check the result.** A scene above the cap is
 *    refused before the `UPDATE`, so the server cannot write a board it would
 *    then refuse to read.
 * 4. **Write with the version guard.** Zero rows means someone else wrote in
 *    between; the caller is told so rather than being told it succeeded.
 */
const editScene = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: {
    boardId: string;
    expectedSceneVersion: number;
    action: string;
    /** Changes the parsed scene in place and returns the ids it touched. */
    apply: (elements: ExcalidrawElement[]) => string[];
  },
): Promise<ElementWriteResult> => {
  const board = await loadBoardForWrite(db, owner, input.boardId);

  if (!board) {
    throw new ToolError(
      `No board with id ${input.boardId} is visible to this server. It may ` +
        "not exist, or it may belong to another owner.",
    );
  }

  if (board.scene_version !== input.expectedSceneVersion) {
    throw new ToolError(
      `Board ${input.boardId} is at scene_version ${board.scene_version}, ` +
        `but this call expected ${input.expectedSceneVersion}. Nothing was ` +
        "written — someone has edited the board since you read it. Re-read " +
        "it with get_board and try again.",
    );
  }

  const scene = readScene(board.scene);
  const elementIds = input.apply(scene.elements);
  const serialised = writeScene(scene);
  const sceneBytes = assertSceneFits(serialised, options, input.action);

  const row = await updateScene(db, owner, {
    boardId: input.boardId,
    scene: serialised,
    sceneBytes,
    expectedSceneVersion: input.expectedSceneVersion,
  });

  if (!row) {
    // The version matched a moment ago, so the only way to land here is a
    // write that arrived in between. Saying so is more useful than a generic
    // failure: the caller's edit is still valid, it just needs a re-read.
    throw new ToolError(
      `Board ${input.boardId} changed while this call was being prepared, so ` +
        "nothing was written. Re-read it with get_board and try again.",
    );
  }

  return {
    board: toBoardMeta(row),
    elementIds,
    message: `${input.action} on board ${row.id}; it is now at scene_version ${row.scene_version}.`,
  };
};

/** Adds one element to a board. */
export const runAddElement = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: AddElementToolInput,
): Promise<ElementWriteResult> => {
  let added: ExcalidrawElement[] = [];

  const result = await editScene(db, owner, options, {
    boardId: input.boardId,
    expectedSceneVersion: input.expectedSceneVersion,
    action: `add a ${input.element.type}`,
    apply: (elements) => {
      const existingIds = new Set(elements.map((element) => element.id));
      added = buildElements(input.element, existingIds);
      elements.push(...added);
      return added.map((element) => element.id);
    },
  });

  const kind = input.element.type;
  const count = added.length > 1 ? `${added.length} elements` : `1 element`;

  return {
    ...result,
    message: `Added ${count} (${kind}) to board ${result.board.id}; it is now at scene_version ${result.board.sceneVersion}.`,
  };
};

/**
 * The fields `update_element` may change, as element updates.
 *
 * `text` and `name` are not ordinary element fields: on a text element `text`
 * is the wrapped form the editor draws and `originalText` is what the person
 * typed, and on a sticky note the label lives in a *separate* element. Both
 * need more than a field assignment, so they are handled by the branch that
 * knows the element kind rather than here.
 */
const isTextLike = (element: ExcalidrawElement): boolean =>
  element.type === "text" || element.type === "stickynote";

/** Applies `update_element` to one element, in place. */
const applyUpdate = (
  elements: ExcalidrawElement[],
  input: UpdateElementInput,
): string[] => {
  const element = findElement(elements, input.elementId);
  const { text, name, ...changes } = input.changes;

  if (text !== undefined && !isTextLike(element)) {
    throw new ToolError(
      `Element ${element.id} is a ${element.type}, which has no text. ` +
        "Nothing was written.",
    );
  }

  if (name !== undefined && element.type !== "frame") {
    throw new ToolError(
      `Element ${element.id} is a ${element.type}, which has no name. ` +
        "Nothing was written.",
    );
  }

  const index = elements.indexOf(element);
  elements[index] = applyElementChanges(element, changes);

  if (name !== undefined) {
    // A frame's name is a frame field, not a field every element has; the
    // schema already refused `name` for anything else, so the cast is the
    // narrowing the branch above established.
    elements[index] = { ...elements[index], name } as ExcalidrawElement;
  }

  if (text !== undefined) {
    elements[index] = applyTextChange(elements, elements[index], text);
  }

  return [elements[index].id];
};

/** Field updates that every element kind shares. */
const applyElementChanges = (
  element: ExcalidrawElement,
  changes: Omit<UpdateElementInput["changes"], "text" | "name">,
): ExcalidrawElement => {
  const { angle, ...rest } = changes;
  const defined = Object.fromEntries(
    Object.entries(rest).filter(([, value]) => value !== undefined),
  );

  return newElementWith(element, {
    ...defined,
    ...(angle !== undefined ? { angle: angle as Radians } : {}),
  } as Parameters<typeof newElementWith>[1]);
};

/**
 * Replaces an element's text, re-fitting whatever contains it.
 *
 * A sticky note is the case that makes this a function rather than an
 * assignment: the body lives in a bound text element, and the note has to be
 * re-fitted around the new body or the text spills out of it. `getStickyNoteLayout`
 * is the editor's own fit, so the result is what typing into the note produces.
 */
const applyTextChange = (
  elements: ExcalidrawElement[],
  element: ExcalidrawElement,
  text: string,
): ExcalidrawElement => {
  if (element.type === "stickynote") {
    const label = elements.find(
      (candidate) =>
        candidate.type === "text" &&
        "containerId" in candidate &&
        candidate.containerId === element.id,
    );

    if (!label) {
      throw new ToolError(
        `Sticky note ${element.id} has no label to change. Nothing was written.`,
      );
    }

    const labelIndex = elements.indexOf(label);
    const updatedLabel = newElementWith(label as ExcalidrawTextElement, {
      text,
      originalText: text,
    });
    const layout = getStickyNoteLayout(
      element as ExcalidrawStickyNoteElement,
      updatedLabel,
    );

    elements[labelIndex] = layout.text
      ? newElementWith(updatedLabel, layout.text)
      : updatedLabel;

    return newElementWith(element, layout.container);
  }

  const textElement = element as ExcalidrawTextElement;
  // A text bound to a shape wraps to that shape's inner width, so the
  // container has to be handed to the re-measure — passing `null` would wrap
  // the label to its own old width and leave it looking unchanged.
  const containerId =
    "containerId" in textElement ? textElement.containerId : null;
  const container = containerId
    ? elements.find((candidate) => candidate.id === containerId) ?? null
    : null;

  return newElementWith(textElement, {
    text,
    originalText: text,
    ...refreshTextDimensions(
      textElement,
      container as ExcalidrawTextContainer | null,
      new Map(),
      text,
    ),
  });
};

/** Changes one element's fields. */
export const runUpdateElement = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: UpdateElementInput,
): Promise<ElementWriteResult> => {
  const result = await editScene(db, owner, options, {
    boardId: input.boardId,
    expectedSceneVersion: input.expectedSceneVersion,
    action: "update an element",
    apply: (elements) => applyUpdate(elements, input),
  });

  return {
    ...result,
    message: `Updated element ${input.elementId} on board ${result.board.id}; it is now at scene_version ${result.board.sceneVersion}.`,
  };
};

/** Moves one element to a new position. */
export const runMoveElement = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: MoveElementInput,
): Promise<ElementWriteResult> => {
  const result = await editScene(db, owner, options, {
    boardId: input.boardId,
    expectedSceneVersion: input.expectedSceneVersion,
    action: "move an element",
    apply: (elements) => {
      const element = findElement(elements, input.elementId);
      const index = elements.indexOf(element);
      elements[index] = newElementWith(element, { x: input.x, y: input.y });
      return [element.id];
    },
  });

  return {
    ...result,
    message: `Moved element ${input.elementId} to (${input.x}, ${input.y}) on board ${result.board.id}; it is now at scene_version ${result.board.sceneVersion}.`,
  };
};

/**
 * Removes one element.
 *
 * Deletion is a mark, not a splice: the editor keeps deleted elements in the
 * scene for undo, and `get_board` counts them separately. Splicing the element
 * out would make the deletion invisible to undo and would change the meaning of
 * every stored index after it.
 */
export const runDeleteElement = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: DeleteElementInput,
): Promise<ElementWriteResult> => {
  const result = await editScene(db, owner, options, {
    boardId: input.boardId,
    expectedSceneVersion: input.expectedSceneVersion,
    action: "delete an element",
    apply: (elements) => {
      const element = findElement(elements, input.elementId);
      const index = elements.indexOf(element);
      elements[index] = newElementWith(element, { isDeleted: true });
      return [element.id];
    },
  });

  return {
    ...result,
    message: `Deleted element ${input.elementId} on board ${result.board.id}; it is now at scene_version ${result.board.sceneVersion}.`,
  };
};
