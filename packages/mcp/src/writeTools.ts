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

import { toBoardMeta } from "./db.js";
import { ToolError } from "./tools.js";
import {
  folderOwned,
  insertBoard,
  loadBoardForWrite,
  logActivity,
  renameBoardRow,
} from "./writes.js";

import type { OwnerIdentity, ServerOptions } from "./config.js";
import type { BoardMeta, Database } from "./db.js";
import type {
  CreateBoardInput,
  DuplicateBoardInput,
  RenameBoardInput,
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
