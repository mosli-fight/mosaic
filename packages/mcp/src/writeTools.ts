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
  isElbowArrow,
  isLinearElement,
  newElementWith,
  refreshTextDimensions,
  rescalePointsInElement,
} from "@excalidraw/element";

import { pointFrom } from "@excalidraw/math";

import type {
  ExcalidrawElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextContainer,
  ExcalidrawTextElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";

import type { Radians } from "@excalidraw/math";

import { toBoardMeta } from "./db.js";
import { defaultDiagramOrigin, renderDiagram } from "./diagram.js";
import {
  addFiles,
  buildElements,
  findElement,
  readScene,
  writeScene,
} from "./sceneEdit.js";
import { ToolError } from "./tools.js";
import {
  duplicateBoardRow,
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
  InsertDiagramInput,
  MoveElementInput,
  RenameBoardInput,
  UpdateElementInput,
} from "./schemas.js";
import type { EditableScene } from "./sceneEdit.js";

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

  // The thumbnail is copied along with the scene, as both storage adapters do:
  // a duplicate with no preview would show a blank card until it was opened.
  const row = await duplicateBoardRow(db, owner, { source, name });

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
    /**
     * Changes the parsed scene in place and returns the ids it touched.
     *
     * The whole scene is handed over rather than just its elements because a
     * diagram insert also adds image files for its icons; every other tool
     * only touches `scene.elements`.
     */
    apply: (scene: EditableScene) => string[];
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
  const elementIds = input.apply(scene);
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
    apply: (scene) => {
      const existingIds = new Set(scene.elements.map((element) => element.id));
      added = buildElements(input.element, existingIds);
      scene.elements.push(...added);
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
  elements[index] = applyGeometry(
    elements,
    applyElementChanges(element, changes),
    changes,
  );

  if (name !== undefined) {
    // A frame's name is a frame field, not a field every element has; the
    // schema already refused `name` for anything else, so the cast is the
    // narrowing the branch above established.
    //
    // `newElementWith` rather than a spread: it is what bumps `version`,
    // `versionNonce` and `updated`, and the editor decides whether an element
    // changed by comparing those. A spread would write the new name and leave
    // the element looking untouched, so a board open in a browser could keep
    // showing the old one.
    elements[index] = newElementWith(elements[index], {
      name,
    } as Parameters<typeof newElementWith>[1]);
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
 * Resizes a linear element by moving its points.
 *
 * On an arrow or a line, `width` and `height` are not independent fields: they
 * are the size of the box the points span, and the editor recomputes them from
 * the points every time the element is restored. Writing a new width without
 * rescaling the points would therefore report a resize that is gone the next
 * time the board is opened — the element would come back at its old size.
 * `rescalePointsInElement` is the editor's own scaling, so the points and the
 * box end up agreeing.
 *
 * The points are normalised first, because the scaling is relative to the
 * origin: an element whose first point is not `[0, 0]` — which the editor
 * normalises away on load, but a stored scene may still hold — would otherwise
 * have its start point dragged away from where it was drawn. Normalising moves
 * that offset into `x`/`y`, where it belongs.
 *
 * Two cases are refused rather than approximated. An elbow arrow's path is
 * generated from its bindings, and a bound arrow's endpoints belong to the
 * shapes it points at; moving either one's points would leave the binding
 * referring to a place the arrow no longer touches.
 */
const resizeLinearElement = (
  element: ExcalidrawElement & {
    points: readonly (readonly [number, number])[];
    elbowed?: boolean;
    startBinding?: unknown;
    endBinding?: unknown;
  },
  width: number,
  height: number,
): ExcalidrawElement => {
  if (element.elbowed) {
    throw new ToolError(
      `Element ${element.id} is an elbow arrow, whose path is generated from ` +
        "its bindings rather than from a box. Nothing was written. Move the " +
        "shapes it connects instead.",
    );
  }

  if (element.startBinding || element.endBinding) {
    throw new ToolError(
      `Element ${element.id} is an arrow bound to a shape, so its endpoints ` +
        "belong to that shape. Nothing was written. Resize the shape, or " +
        "delete the arrow and add an unbound one.",
    );
  }

  const [offsetX, offsetY] = element.points[0] ?? [0, 0];
  const normalised = {
    ...element,
    x: element.x + offsetX,
    y: element.y + offsetY,
    points: element.points.map(([x, y]) => pointFrom(x - offsetX, y - offsetY)),
  } as NonDeletedExcalidrawElement;

  return newElementWith(normalised, {
    width,
    height,
    ...rescalePointsInElement(normalised, width, height, true),
  } as Parameters<typeof newElementWith>[1]);
};

/**
 * Applies a sticky note's new box and re-fits the label inside it.
 *
 * A note's height is derived, not stored: `getStickyNoteLayout` computes it
 * from `baseHeight` and how the label wraps, so a height written without
 * `baseHeight` is undone the first time the note is laid out — which happens
 * as soon as its text is edited. Setting both and re-fitting the label is what
 * dragging the note's handle produces, and it is what keeps the body inside
 * the card after the card gets wider.
 *
 * A width-only change leaves `baseHeight` alone, matching the editor's side
 * handles: widening a note should not also make it taller.
 */
const resizeStickyNote = (
  elements: ExcalidrawElement[],
  note: ExcalidrawStickyNoteElement,
  requested: { width?: number; height?: number },
): ExcalidrawStickyNoteElement => {
  const resized = newElementWith(note, {
    ...(requested.width !== undefined ? { width: requested.width } : {}),
    ...(requested.height !== undefined
      ? { height: requested.height, baseHeight: requested.height }
      : {}),
  } as Parameters<typeof newElementWith>[1]) as ExcalidrawStickyNoteElement;

  const label = elements.find(
    (candidate) =>
      candidate.type === "text" &&
      "containerId" in candidate &&
      candidate.containerId === note.id,
  ) as ExcalidrawTextElement | undefined;

  if (!label) {
    return resized;
  }

  const layout = getStickyNoteLayout(resized, label);

  if (layout.text) {
    elements[elements.indexOf(label)] = newElementWith(label, layout.text);
  }

  return newElementWith(
    resized,
    layout.container,
  ) as ExcalidrawStickyNoteElement;
};

/**
 * The geometry fields, applied to the kinds whose box is not a plain field.
 *
 * Everything else — a rectangle, an ellipse, a frame — stores `width` and
 * `height` as ordinary fields, so {@link applyElementChanges} has already
 * written them and there is nothing to do here.
 */
const applyGeometry = (
  elements: ExcalidrawElement[],
  element: ExcalidrawElement,
  requested: { width?: number; height?: number },
): ExcalidrawElement => {
  const { width, height } = requested;

  if (width === undefined && height === undefined) {
    return element;
  }

  if (element.type === "text") {
    // A text element's box is its measured text, and the app does not
    // re-measure stored text when it opens a board. Writing a width here would
    // therefore leave a box that disagrees with the glyphs inside it, and the
    // editor has no way to notice.
    throw new ToolError(
      `Element ${element.id} is a text element, whose size comes from its ` +
        "text. Nothing was written. Change `text` instead; the box is " +
        "re-measured to fit it.",
    );
  }

  if (isLinearElement(element)) {
    return resizeLinearElement(
      element,
      width ?? element.width,
      height ?? element.height,
    );
  }

  if (element.type === "stickynote") {
    return resizeStickyNote(
      elements,
      element as ExcalidrawStickyNoteElement,
      requested,
    );
  }

  return element;
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
    apply: (scene) => applyUpdate(scene.elements, input),
  });

  return {
    ...result,
    message: `Updated element ${input.elementId} on board ${result.board.id}; it is now at scene_version ${result.board.sceneVersion}.`,
  };
};

/**
 * Moves one element, and whatever moves with it.
 *
 * A container and its contents are separate elements, so moving only the one
 * the caller named would leave the rest behind: a sticky note's label is a
 * second element with a `containerId`, and a frame's children are elements
 * carrying its `frameId`. The editor never produces that state — dragging a
 * note selects its label too, and dragging a frame drags its children — so
 * this mirrors what a drag does rather than inventing a rule.
 *
 * The delta is applied to everything, so relative positions are preserved.
 */
const moveElementAndContents = (
  elements: ExcalidrawElement[],
  element: ExcalidrawElement,
  x: number,
  y: number,
): string[] => {
  const dx = x - element.x;
  const dy = y - element.y;
  const moved = new Set<string>([element.id]);

  // A worklist rather than one pass, because contents nest: a sticky note
  // inside a frame has a label of its own, and moving the frame has to take
  // both. Each element is visited once, so a cycle in `containerId` could not
  // loop forever even if one were somehow stored.
  const queue = [element.id];
  while (queue.length) {
    const parentId = queue.shift()!;

    for (const candidate of elements) {
      if (moved.has(candidate.id) || candidate.isDeleted) {
        continue;
      }

      const boundToParent =
        "containerId" in candidate && candidate.containerId === parentId;
      const insideParent =
        "frameId" in candidate && candidate.frameId === parentId;

      if (!boundToParent && !insideParent) {
        continue;
      }

      moved.add(candidate.id);
      queue.push(candidate.id);
      const index = elements.indexOf(candidate);
      elements[index] = newElementWith(candidate, {
        x: candidate.x + dx,
        y: candidate.y + dy,
      });
    }
  }

  const index = elements.indexOf(element);
  elements[index] = newElementWith(element, { x, y });

  return [...moved];
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
    apply: (scene) => {
      const element = findElement(scene.elements, input.elementId);
      return moveElementAndContents(scene.elements, element, input.x, input.y);
    },
  });

  return {
    ...result,
    message: `Moved element ${input.elementId} to (${input.x}, ${input.y}) on board ${result.board.id}; it is now at scene_version ${result.board.sceneVersion}.`,
  };
};

/**
 * Removes one element, and what cannot outlive it.
 *
 * Deletion is a mark, not a splice: the editor keeps deleted elements in the
 * scene for undo, and `get_board` counts them separately. Splicing the element
 * out would make the deletion invisible to undo and would change the meaning of
 * every stored index after it.
 *
 * A container's bound label goes with it, because a label is not an element in
 * its own right: the renderer skips a text whose `containerId` is still in the
 * map, and the map is built from non-deleted elements. Deleting only the note
 * would leave a live label whose container is gone — which the renderer does
 * *not* skip, so the text would be drawn loose on the canvas. The app's own
 * delete cascades for the same reason (`actionDeleteSelected`).
 *
 * A frame's children are *not* deleted: the app clears their `frameId` and
 * leaves them on the canvas, because a frame is a grouping rather than a
 * container. The same is done here.
 *
 * An elbow arrow bound to the deleted element loses that binding, because its
 * path is generated from the shapes it connects: the app clears the binding
 * when the shape goes (`actionDeleteSelected`), and an elbow arrow left
 * pointing at a deleted shape would be re-routed against nothing on the next
 * load.
 */
const deleteElementAndContents = (
  elements: ExcalidrawElement[],
  element: ExcalidrawElement,
): string[] => {
  const deleted = new Set<string>([element.id]);

  for (const candidate of elements) {
    if (candidate.isDeleted) {
      continue;
    }

    const boundToElement =
      "containerId" in candidate && candidate.containerId === element.id;
    const insideFrame =
      "frameId" in candidate && candidate.frameId === element.id;

    // One replacement per candidate, so the label cascade and the binding
    // cleanup cannot overwrite each other's edit.
    const changes: Record<string, unknown> = {};

    if (boundToElement) {
      deleted.add(candidate.id);
      changes.isDeleted = true;
    } else if (insideFrame) {
      // The child stays; it just stops belonging to a frame that is gone.
      changes.frameId = null;
    }

    // The app walks `boundElements` to find these; reading the bindings
    // directly is the same set for a scene the editor wrote, and also catches
    // one whose `boundElements` is stale.
    if (isElbowArrow(candidate)) {
      if (candidate.startBinding?.elementId === element.id) {
        changes.startBinding = null;
      }
      if (candidate.endBinding?.elementId === element.id) {
        changes.endBinding = null;
      }
    }

    if (Object.keys(changes).length) {
      elements[elements.indexOf(candidate)] = newElementWith(
        candidate,
        changes as Parameters<typeof newElementWith>[1],
      );
    }
  }

  elements[elements.indexOf(element)] = newElementWith(element, {
    isDeleted: true,
  });

  return [...deleted];
};

/** Removes one element. */
export const runDeleteElement = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: DeleteElementInput,
): Promise<ElementWriteResult> => {
  let deleted: string[] = [];

  const result = await editScene(db, owner, options, {
    boardId: input.boardId,
    expectedSceneVersion: input.expectedSceneVersion,
    action: "delete an element",
    apply: (scene) => {
      const element = findElement(scene.elements, input.elementId);
      deleted = deleteElementAndContents(scene.elements, element);
      return deleted;
    },
  });

  const also = deleted.slice(1);

  return {
    ...result,
    message: `Deleted element ${input.elementId} on board ${
      result.board.id
    }; it is now at scene_version ${result.board.sceneVersion}.${
      also.length ? ` Its label (${also.join(", ")}) went with it.` : ""
    }`,
  };
};

/**
 * Renders diagram code and puts it on a board.
 *
 * The engine's rule is that a diagram owns the elements it made and nothing
 * else, so hand-drawn work on the board is passed through untouched — that is
 * `reconcileDiagram`'s job, not this function's. What this function adds is
 * the scene-level part: merging the icons' image files, and saying in the
 * result how many elements the diagram contributed and what box it occupies.
 *
 * Inserting a second diagram replaces the first. The tags that identify a
 * node are its slug, so two diagrams on one board would collide; the pane has
 * the same rule, and the tool is annotated `destructiveHint: true` for it.
 */
export const runInsertDiagram = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: InsertDiagramInput,
): Promise<ElementWriteResult> => {
  let rendered: ReturnType<typeof renderDiagram> | null = null;

  const result = await editScene(db, owner, options, {
    boardId: input.boardId,
    expectedSceneVersion: input.expectedSceneVersion,
    action: `insert a ${input.type} diagram`,
    apply: (scene: EditableScene) => {
      // A caller may pin one axis and leave the other to the default, which
      // is what makes "put it under everything else" expressible.
      const fallback = defaultDiagramOrigin(scene.elements);
      const origin =
        input.x === undefined && input.y === undefined
          ? undefined
          : {
              x: input.x ?? fallback.x,
              y: input.y ?? fallback.y,
            };

      rendered = renderDiagram(scene.elements, input.code, input.type, origin);
      scene.elements = rendered.elements;
      addFiles(scene, rendered.files);
      return rendered.elementIds;
    },
  });

  // `editScene` only returns after `apply` has run, so this is set.
  const diagram = rendered as ReturnType<typeof renderDiagram> | null;
  const count = diagram?.elementIds.length ?? 0;
  const box = diagram?.bounds;

  return {
    ...result,
    message: `${
      `Inserted a ${input.type} diagram (${count} elements) on board ` +
      `${result.board.id}; it is now at scene_version ` +
      `${result.board.sceneVersion}.`
    }${
      box
        ? ` It occupies (${box.x}, ${box.y}) to (${box.x + box.width}, ${
            box.y + box.height
          }).`
        : ""
    }`,
  };
};
