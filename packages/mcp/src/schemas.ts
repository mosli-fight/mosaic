/**
 * Input schemas and the validation helpers the tools share.
 *
 * ## Why the schemas are strict
 *
 * A tool's input schema is the only contract a model sees. Two failure modes
 * matter more here than in a normal API:
 *
 * - **Silently coerced input.** A model that sends `"limit": "10"` and gets ten
 *   results has learned nothing about what the schema accepts, and will keep
 *   sending strings. Rejecting it produces an error the model can act on.
 * - **Unbounded input.** An unbounded `limit` is how a tool call becomes a
 *   multi-megabyte reply. Every list here is capped, and the cap is part of the
 *   schema so it is visible before the call, not after.
 *
 * `.strict()` is used throughout so an unknown key is an error rather than
 * noise. A model that invents `includeDeleted` should be told the field does not
 * exist, not have it ignored while the call appears to succeed.
 */

import { z } from "zod";

/** Largest page a caller may request from `list_boards`. */
export const MAX_LIST_LIMIT = 100;

/** Largest page a caller may request from `search_boards`. */
export const MAX_SEARCH_LIMIT = 50;

/** Longest search term accepted. */
export const MAX_SEARCH_TERM = 200;

/**
 * A board id.
 *
 * Validated as a UUID before it reaches Postgres. An invalid id would otherwise
 * raise `22P02` in the driver and surface as an internal error, when the caller
 * simply sent something that is not an id. The pattern matches the one in
 * `api/boards/[id].ts` so both surfaces reject the same values.
 */
export const boardIdSchema = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    "must be a board UUID",
  );

export const listBoardsInput = z
  .object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_LIST_LIMIT)
      .optional()
      .describe(
        `How many boards to return (1-${MAX_LIST_LIMIT}, default 20). ` +
          "Metadata only — scenes are never included in a listing.",
      ),
    offset: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe("How many boards to skip, for paging (default 0)."),
    includeTrashed: z
      .boolean()
      .optional()
      .describe(
        "Include boards in the trash (default false). Trashed boards are " +
          "soft-deleted and still recoverable in the app.",
      ),
    folderId: z
      .string()
      .uuid()
      .optional()
      .describe("Only boards in this folder."),
    unfiled: z
      .boolean()
      .optional()
      .describe(
        "Only boards that are in no folder (default false). Ignored when " +
          "folderId is given.",
      ),
  })
  .strict();

export type ListBoardsInput = z.infer<typeof listBoardsInput>;

export const getBoardInput = z
  .object({
    boardId: boardIdSchema.describe(
      "The board's id, as returned by list_boards.",
    ),
    includeElements: z
      .boolean()
      .optional()
      .describe(
        "Also return a capped list of individual elements (default false). " +
          "Each entry has id, type, position, size and its primary text.",
      ),
  })
  .strict();

export type GetBoardInput = z.infer<typeof getBoardInput>;

export const searchBoardsInput = z
  .object({
    query: z
      .string()
      .trim()
      .min(1, "search query cannot be empty")
      .max(
        MAX_SEARCH_TERM,
        `search query cannot exceed ${MAX_SEARCH_TERM} characters`,
      )
      .describe(
        "Text to look for. Matches board names and the text inside board " +
          "scenes (labels, notes, code blocks, frame names, links).",
      ),
    limit: z
      .number()
      .int()
      .min(1)
      .max(MAX_SEARCH_LIMIT)
      .optional()
      .describe(
        `Maximum matches to return (1-${MAX_SEARCH_LIMIT}, default 20).`,
      ),
    includeTrashed: z
      .boolean()
      .optional()
      .describe("Also search boards in the trash (default false)."),
  })
  .strict();

export type SearchBoardsInput = z.infer<typeof searchBoardsInput>;

// ---------------------------------------------------------------------------
// Write tools
// ---------------------------------------------------------------------------

/** Longest board name accepted, in characters. */
export const MAX_BOARD_NAME = 200;

/**
 * A board name.
 *
 * Trimmed and non-empty, because `renameBoard` in the app refuses a blank name
 * and the HTTP API answers 400 for one — a server that accepted `"   "` would
 * store a board the dashboard renders as an empty card.
 *
 * The upper bound is not arbitrary: a name is rendered in a card, a tab and a
 * breadcrumb, and a model that pastes a paragraph into it has misunderstood the
 * field. Rejecting it teaches the shape of the input, which is the same reason
 * the read schemas cap their limits.
 */
export const boardNameSchema = z
  .string()
  .trim()
  .min(1, "board name cannot be empty")
  .max(MAX_BOARD_NAME, `board name cannot exceed ${MAX_BOARD_NAME} characters`);

/**
 * The scene version a write expects to find.
 *
 * This is the optimistic-concurrency token the editor already uses
 * (`scene_version` in the schema, `baseVersion` in `saveBoardScene`). A write
 * that passes a stale value must fail rather than overwrite: the person who
 * edited the board in the app has newer work, and silently replacing it is the
 * one outcome a tool must never produce.
 *
 * Non-negative because the column starts at 0 and only ever increments.
 */
export const sceneVersionSchema = z
  .number()
  .int()
  .min(0)
  .describe(
    "The scene_version the edit was based on, as returned by get_board or " +
      "list_boards. The write is refused if the board has moved on since, " +
      "rather than overwriting newer work.",
  );

export const createBoardInput = z
  .object({
    name: boardNameSchema
      .optional()
      .describe('Board name. Defaults to "Untitled board".'),
    folderId: z
      .string()
      .uuid()
      .optional()
      .describe(
        "Folder to file the board in. Must be one of your own folders; an " +
          "unknown or someone else's folder is refused.",
      ),
  })
  .strict();

export type CreateBoardInput = z.infer<typeof createBoardInput>;

export const renameBoardInput = z
  .object({
    boardId: boardIdSchema.describe("The board to rename."),
    name: boardNameSchema.describe("The new name."),
    expectedSceneVersion: sceneVersionSchema.optional(),
  })
  .strict();

export type RenameBoardInput = z.infer<typeof renameBoardInput>;

export const duplicateBoardInput = z
  .object({
    boardId: boardIdSchema.describe("The board to copy."),
    name: boardNameSchema
      .optional()
      .describe('Name for the copy. Defaults to "<original> (copy)".'),
  })
  .strict();

export type DuplicateBoardInput = z.infer<typeof duplicateBoardInput>;

// ---------------------------------------------------------------------------
// Element tools
// ---------------------------------------------------------------------------

/**
 * A coordinate or size in scene units.
 *
 * `.finite()` is the important half. `z.number()` accepts `Infinity`, and a
 * single infinite coordinate poisons every derived value: the element's bounds
 * become infinite, the board's bounding box becomes infinite, and the editor's
 * viewport maths produces `NaN` from there. JSON cannot even carry `Infinity`,
 * so a caller that sends it has a bug worth reporting rather than a value worth
 * storing.
 *
 * The magnitude cap is the editor's own: `newElement` logs a warning past
 * ±1,000,000 because elements that far out are a sign of a unit mistake (a
 * caller passing pixels where scene units were meant, or a stray exponent).
 * Rejecting is better than warning, because a warning reaches nobody here.
 */
export const coordinateSchema = z
  .number()
  .finite("must be a finite number")
  .min(-1_000_000, "must be at least -1,000,000")
  .max(1_000_000, "must be at most 1,000,000");

/**
 * A size in scene units.
 *
 * Zero is allowed because the editor allows it — a zero-width rectangle is a
 * legal, if invisible, element, and refusing it would make the schema stricter
 * than the format. Negative is not: a negative width is not a size, and the
 * editor's bounds maths treats the sign inconsistently.
 */
export const sizeSchema = z
  .number()
  .finite("must be a finite number")
  .min(0, "must not be negative")
  .max(1_000_000, "must be at most 1,000,000");

/** A CSS colour, as the editor stores it: `#rgb`, `#rrggbb` or `transparent`. */
export const colorSchema = z
  .string()
  .regex(
    /^(#[0-9a-f]{3}|#[0-9a-f]{6}|transparent)$/i,
    'must be a hex colour (#rgb or #rrggbb) or "transparent"',
  );

/** The style fields every element kind accepts. */
const elementStyleShape = {
  strokeColor: colorSchema
    .optional()
    .describe('Stroke colour, e.g. "#1e1e1e". Defaults to near-black.'),
  backgroundColor: colorSchema
    .optional()
    .describe(
      'Fill colour, e.g. "#a5d8ff". Defaults to "transparent". Only visible ' +
        "when fillStyle is not transparent.",
    ),
  fillStyle: z
    .enum(["hachure", "cross-hatch", "solid", "zigzag"])
    .optional()
    .describe('How the fill is painted. Defaults to "solid".'),
  strokeWidth: z
    .number()
    .finite()
    .min(0)
    .max(32)
    .optional()
    .describe("Stroke width in pixels. Defaults to 2."),
  strokeStyle: z
    .enum(["solid", "dashed", "dotted"])
    .optional()
    .describe('Stroke pattern. Defaults to "solid".'),
  roughness: z
    .number()
    .finite()
    .min(0)
    .max(4)
    .optional()
    .describe(
      "Hand-drawn wobble: 0 is architect (straight), 1 artist (default), " +
        "2 cartoonist (loose).",
    ),
  opacity: z
    .number()
    .finite()
    .min(0)
    .max(100)
    .optional()
    .describe("Opacity percentage, 0-100. Defaults to 100."),
  angle: z
    .number()
    .finite()
    .optional()
    .describe("Rotation in radians. Defaults to 0 (upright)."),
  locked: z
    .boolean()
    .optional()
    .describe("Lock the element against edits in the app. Defaults to false."),
  link: z
    .string()
    .url("must be a URL")
    .max(2000)
    .optional()
    .describe("A URL the element links to when clicked."),
};

/** Style fields, as a standalone object for the tools that only restyle. */
export const elementStyleInput = z.object(elementStyleShape).strict();

export type ElementStyleInput = z.infer<typeof elementStyleInput>;

/**
 * The kinds of element `add_element` can create.
 *
 * Deliberately a closed list. The editor has more element types — images,
 * embeds, code blocks, freehand — and each needs data this server cannot
 * supply (a file, a URL to fetch, a rasterised stroke path). Offering them
 * would mean accepting a call that cannot succeed.
 */
export const ADDABLE_ELEMENT_TYPES = [
  "rectangle",
  "ellipse",
  "arrow",
  "text",
  "stickynote",
  "frame",
] as const;

export type AddableElementType = typeof ADDABLE_ELEMENT_TYPES[number];

/** A point on an arrow, relative to the arrow's own origin. */
export const arrowPointSchema = z
  .tuple([coordinateSchema, coordinateSchema])
  .describe("A point relative to the arrow's x/y, as [x, y].");

/**
 * The arrowheads the editor can draw.
 *
 * The list is the non-legacy half of `Arrowhead` in `packages/element`: the
 * legacy names (`dot`, `crowfoot_*`) still render but are no longer offered by
 * the UI, so a tool that accepted them would be inviting new content in an old
 * format. The cardinality heads are ERD notation and are reachable through the
 * diagram engine rather than by hand.
 */
export const ARROWHEADS = [
  "arrow",
  "bar",
  "circle",
  "circle_outline",
  "triangle",
  "triangle_outline",
  "diamond",
  "diamond_outline",
] as const;

export const arrowheadSchema = z.enum(ARROWHEADS);

/**
 * One element to add.
 *
 * A discriminated union on `type`, and every branch `.strict()`. That pairing
 * is what makes the schema teach the format: a caller that sends `text` to the
 * rectangle branch is told `text` is not a rectangle field, rather than having
 * it dropped and wondering why the shape is blank.
 */
export const addElementInput = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("rectangle"),
      x: coordinateSchema,
      y: coordinateSchema,
      width: sizeSchema,
      height: sizeSchema,
      ...elementStyleShape,
    })
    .strict(),
  z
    .object({
      type: z.literal("ellipse"),
      x: coordinateSchema,
      y: coordinateSchema,
      width: sizeSchema,
      height: sizeSchema,
      ...elementStyleShape,
    })
    .strict(),
  z
    .object({
      type: z.literal("arrow"),
      x: coordinateSchema.describe("The arrow's start x."),
      y: coordinateSchema.describe("The arrow's start y."),
      width: sizeSchema.describe(
        "Used only when points is omitted: the arrow runs to (x+width, y+height).",
      ),
      height: sizeSchema.describe(
        "Used only when points is omitted: the arrow runs to (x+width, y+height).",
      ),
      points: z
        .array(arrowPointSchema)
        .min(2, "an arrow needs at least a start and an end point")
        .max(100)
        .optional()
        .describe(
          "The arrow's path, relative to its x/y. Defaults to a straight " +
            "line from (0,0) to (width,height).",
        ),
      startArrowhead: arrowheadSchema
        .nullable()
        .optional()
        .describe("Head at the start. Defaults to none."),
      endArrowhead: arrowheadSchema
        .nullable()
        .optional()
        .describe('Head at the end. Defaults to "arrow".'),
      ...elementStyleShape,
    })
    .strict(),
  z
    .object({
      type: z.literal("text"),
      x: coordinateSchema,
      y: coordinateSchema,
      text: z
        .string()
        .min(1, "text cannot be empty")
        .max(10_000, "text cannot exceed 10,000 characters"),
      fontSize: z
        .number()
        .finite()
        .min(4)
        .max(512)
        .optional()
        .describe("Font size in pixels. Defaults to 20."),
      fontFamily: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe(
          "Font family id: 1 hand-drawn, 2 Helvetica, 3 code, 5 Excalifont " +
            "(default), 6 Nunito, 7 Lilita One, 8 Comic Shanns.",
        ),
      textAlign: z
        .enum(["left", "center", "right"])
        .optional()
        .describe('Horizontal alignment. Defaults to "left".'),
      verticalAlign: z
        .enum(["top", "middle", "bottom"])
        .optional()
        .describe('Vertical alignment. Defaults to "top".'),
      ...elementStyleShape,
    })
    .strict(),
  z
    .object({
      type: z.literal("stickynote"),
      x: coordinateSchema,
      y: coordinateSchema,
      width: sizeSchema.optional().describe("Note width. Defaults to 250."),
      height: sizeSchema
        .optional()
        .describe("Note height. Defaults to the width, or 250."),
      text: z
        .string()
        .max(10_000, "text cannot exceed 10,000 characters")
        .optional()
        .describe(
          "The note's body. The note grows to fit it, so a long body makes a " +
            "tall note rather than overflowing.",
        ),
      author: z
        .string()
        .max(200)
        .optional()
        .describe("Shown in the note's footer."),
      tags: z
        .array(z.string().max(100))
        .max(20)
        .optional()
        .describe("Tags shown as pills under the body."),
      ...elementStyleShape,
    })
    .strict(),
  z
    .object({
      type: z.literal("frame"),
      x: coordinateSchema,
      y: coordinateSchema,
      width: sizeSchema,
      height: sizeSchema,
      name: z.string().max(MAX_BOARD_NAME).optional(),
      ...elementStyleShape,
    })
    .strict(),
]);

export type AddElementInput = z.infer<typeof addElementInput>;

/**
 * The spec one branch of {@link addElementInput} describes.
 *
 * The write code switches on `type`, and each branch only reads its own
 * fields, so this alias names the union the switch narrows.
 */
export type AddElementSpec = AddElementInput;

/**
 * The identity of one element on a board.
 *
 * Every element tool takes this pair: the board, and the element. The element
 * id alone would be ambiguous across boards, and the board is what the owner
 * scope is applied to.
 */
const elementTargetShape = {
  boardId: boardIdSchema.describe("The board holding the element."),
  elementId: z
    .string()
    .trim()
    .min(1, "elementId cannot be empty")
    .max(200)
    .describe("The element's id, as returned by get_board."),
  expectedSceneVersion: sceneVersionSchema,
};

export const addElementToolInput = z
  .object({
    boardId: boardIdSchema.describe(
      "The board to add the element to. Create one with create_board first.",
    ),
    expectedSceneVersion: sceneVersionSchema,
    element: addElementInput.describe(
      "The element to add. Its `type` decides which fields are accepted.",
    ),
  })
  .strict();

export type AddElementToolInput = z.infer<typeof addElementToolInput>;

export const updateElementInput = z
  .object({
    ...elementTargetShape,
    changes: z
      .object({
        x: coordinateSchema.optional(),
        y: coordinateSchema.optional(),
        width: sizeSchema.optional(),
        height: sizeSchema.optional(),
        text: z
          .string()
          .min(1, "text cannot be empty")
          .max(10_000)
          .optional()
          .describe(
            "New text. Only for text elements and sticky notes; a sticky " +
              "note's label is re-fitted to its body.",
          ),
        name: z
          .string()
          .max(MAX_BOARD_NAME)
          .optional()
          .describe("New name. Only for frames."),
        ...elementStyleShape,
      })
      .strict(),
  })
  .strict();

export type UpdateElementInput = z.infer<typeof updateElementInput>;

export const moveElementInput = z
  .object({
    ...elementTargetShape,
    x: coordinateSchema.describe("The element's new x."),
    y: coordinateSchema.describe("The element's new y."),
  })
  .strict();

export type MoveElementInput = z.infer<typeof moveElementInput>;

export const deleteElementInput = z.object({ ...elementTargetShape }).strict();

export type DeleteElementInput = z.infer<typeof deleteElementInput>;

/** Longest diagram source accepted, in characters. */
export const MAX_DIAGRAM_CODE = 20_000;

/**
 * The diagram types the pane can draw.
 *
 * The same four the editor offers. The list is closed because the type decides
 * how the code is read — a colon means something different in a flowchart and
 * an ERD — so an unknown value has no defined parse at all.
 */
export const DIAGRAM_TYPES = [
  "flowchart",
  "architecture",
  "erd",
  "sequence",
] as const;

export const diagramTypeSchema = z
  .enum(DIAGRAM_TYPES)
  .describe(
    "Which diagram language the code is written in: flowchart, architecture, " +
      "erd or sequence.",
  );

export const insertDiagramInput = z
  .object({
    boardId: boardIdSchema.describe("The board to insert the diagram into."),
    expectedSceneVersion: sceneVersionSchema,
    type: diagramTypeSchema,
    code: z
      .string()
      .min(1, "diagram code cannot be empty")
      .max(
        MAX_DIAGRAM_CODE,
        `diagram code cannot exceed ${MAX_DIAGRAM_CODE} characters`,
      )
      .describe(
        "The diagram in the pane's own language, one statement per line. " +
          'For example "api: API server" for a node and "api -> db: reads" ' +
          "for an arrow.",
      ),
    x: coordinateSchema
      .optional()
      .describe(
        "Left edge of the diagram. Defaults to the right of whatever is " +
          "already on the board, so the diagram does not cover existing work.",
      ),
    y: coordinateSchema
      .optional()
      .describe("Top edge of the diagram. Defaults to the same as x's row."),
  })
  .strict();

export type InsertDiagramInput = z.infer<typeof insertDiagramInput>;

/**
 * Normalises a search term for comparison.
 *
 * Case-folding only. Whitespace is *not* collapsed: a search for "two  words"
 * should not silently match "two words", because the caller can see the term
 * they sent and would have no way to explain the mismatch.
 */
export const normalizeSearchTerm = (term: string): string => term.toLowerCase();

/** Whether `haystack` contains `needle`, both already lower-cased. */
export const containsTerm = (haystack: string, needle: string): boolean =>
  haystack.toLowerCase().includes(needle);
