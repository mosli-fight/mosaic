# `@mosaic/mcp`

A [Model Context Protocol](https://modelcontextprotocol.io) server for Mosaic boards, over stdio, from Claude Desktop or any other MCP client. A model can list your boards, read a compact summary of what is on one, search across them, create boards and change what is on them, draw a diagram from code and read it back as code, insert one of the gallery's templates, and export a board as an image.

## Quick start

```bash
yarn --cwd packages/mcp build
```

Then add an entry to your client's configuration (see [`claude-desktop.example.json`](./claude-desktop.example.json)):

```json
{
  "mcpServers": {
    "mosaic": {
      "command": "node",
      "args": ["/absolute/path/to/mosaic/packages/mcp/dist/index.js"],
      "env": {
        "DATABASE_URL": "postgres://…",
        "MOSAIC_USER_ID": "…"
      }
    }
  }
}
```

Restart the client. The server writes `[mosaic-mcp] ready — reading and writing boards for signed-in account` to stderr when it has connected; stderr is the client's log, and is the only place this server ever writes diagnostics.

## Tools

Fifteen tools: five read, ten write.

| Tool              | Writes | Annotations              |
| ----------------- | ------ | ------------------------ |
| `list_boards`     | no     | `readOnlyHint: true`     |
| `get_board`       | no     | `readOnlyHint: true`     |
| `search_boards`   | no     | `readOnlyHint: true`     |
| `export_board`    | no     | `readOnlyHint: true`     |
| `scene_to_dsl`    | no     | `readOnlyHint: true`     |
| `create_board`    | yes    | `destructiveHint: false` |
| `rename_board`    | yes    | `destructiveHint: false` |
| `duplicate_board` | yes    | `destructiveHint: false` |
| `add_element`     | yes    | `destructiveHint: false` |
| `update_element`  | yes    | `destructiveHint: true`  |
| `move_element`    | yes    | `destructiveHint: true`  |
| `delete_element`  | yes    | `destructiveHint: true`  |
| `insert_diagram`  | yes    | `destructiveHint: true`  |
| `apply_dsl`       | yes    | `destructiveHint: true`  |
| `insert_template` | yes    | `destructiveHint: true`  |

`destructiveHint` is not decoration: a client's confirmation UI is driven by it. Every write tool is `readOnlyHint: false`.

`export_board` and `scene_to_dsl` are reads — neither writes a row — but they are not cheap metadata queries either: each parses the whole scene, and the export renders it. They are grouped with the reads because "can this change my board?" has one answer.

### Reading

#### `list_boards`

Lists boards, most recently used first. **Metadata only** — the scene is never selected by this query, so a listing cannot leak board content however large it is.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | int 1–100 | `20` | Page size. |
| `offset` | int ≥ 0 | `0` | Boards to skip. |
| `includeTrashed` | boolean | `false` | Include soft-deleted boards. |
| `folderId` | uuid | — | Only boards in this folder. |
| `unfiled` | boolean | `false` | Only boards in no folder. Ignored with a folder id. |

Each board is returned as `id`, `name`, `folderId`, `folderName`, `favorite`, `trashed`, `sceneVersion`, `createdAt`, `updatedAt`, `lastOpenedAt`, `sceneBytes`. The response also carries `total`, `limit`, `offset` and `hasMore`, so a caller can page without guessing from a short page.

#### `get_board`

Reads one board: its metadata, plus a **summary** of the scene.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `boardId` | uuid | — | Required. |
| `includeElements` | boolean | `false` | Also return a capped list of individual elements. |

The summary contains:

- **`counts`** — total, visible and deleted element counts, and a breakdown by element type.
- **`text`** — every piece of text on the board, each tagged with where it came from: `text`, `code`, `frame-name`, `frame-notes`, `link`, `sticky-author`, `sticky-tag`. Capped per item, by item count, and by total characters; `omitted` and `truncated` say what was cut.
- **`bounds`** — the bounding box of the visible elements, so "how big is this diagram?" is answerable.
- **`files`** — how many images are embedded and how large they are. Never their data.
- **`appState`** — only `name`, `viewBackgroundColor` and `gridSize`. Viewport state is not board content.
- **`elements`** — only when `includeElements` is true: id, type, position, size and primary text, capped at `maxElements`.

The raw scene is never returned. A scene that cannot be parsed is reported in `parseError` rather than failing the call, because the metadata is still useful.

#### `search_boards`

Matches board **names** and the **text inside scenes**.

| Input            | Type     | Default | Notes                       |
| ---------------- | -------- | ------- | --------------------------- |
| `query`          | string   | —       | 1–200 characters, required. |
| `limit`          | int 1–50 | `20`    | Maximum matches.            |
| `includeTrashed` | boolean  | `false` | Also search the trash.      |

Each match reports `matchedOn` (`name`, `content`, or both) and a short `excerpts` list around each content hit. Name matches sort first. The response also reports `boardsSearched` and `boardsSkipped` — a board whose scene is too large to parse is counted as skipped rather than silently reported as a non-match.

Matching is case-insensitive and literal: `$5` matches the text `$5`, and `.*` matches nothing unless a board literally contains `.*`.

### Reading a board as code or as an image

Two reads that parse the whole scene rather than its metadata.

#### `scene_to_dsl`

Reads a board's diagram back out as the pane's own code.

| Input     | Type | Notes     |
| --------- | ---- | --------- |
| `boardId` | uuid | Required. |

The result carries:

- **`code`** — the diagram as text, ready to edit and hand to `apply_dsl`.
- **`type`** — the language it is written in, inferred from the elements: lifelines mean `sequence`, fields mean `erd`, a diamond (or a flowchart-implied ellipse) means `flowchart`, otherwise `architecture`.
- **`counts`** — nodes, edges and groups written.
- **`skipped`** — everything on the board the language cannot express, each with an `id`, `type` and `reason`. **Nothing is silently dropped.** Hand-drawn elements are listed here, and so is a diagram element the DSL cannot name — a node whose label contains `#`, braces, brackets or an arrow token, a node with no label, or a second node whose label folds to the same slug as another.
- **`warnings`** — the one structural caveat: nodes inside a brace group have to be written together, so a diagram whose groups interleave in layout order comes back with its nodes in a different order, which can shift them within their column.

The code is derived from the **elements**, not from whatever `appState.diagramCode` happens to hold, so a diagram edited by hand in the pane reads back as what is actually drawn.

**Round trip.** `scene_to_dsl` then `apply_dsl` on a fresh board reproduces the diagram. To keep that true, the reader infers the type, emits only attributes that are not implied by the type (a decision is a diamond without saying so), and writes nodes in scene order. The tests assert the round trip by rendering the generated code again and comparing element signatures and labels.

#### `export_board`

Renders a board to an image.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `boardId` | uuid | — | Required. |
| `format` | `svg` \| `png` | `svg` | See the PNG limitation below. |
| `padding` | int 0–200 | `10` | Space around the content, in scene units. |
| `background` | boolean | `true` | Paint the board's background colour; `false` is transparent. |

Returns the SVG document as `content`, its size in `bytes`, and its `width`/`height` from the viewBox — so a caller can size the page it goes on. Write `content` to a `.svg` file as-is.

It uses the app's own export pipeline (`exportToSvg` from `packages/excalidraw/scene/export`), not a second renderer, so the picture is the one the app would produce. Fonts are not inlined: the SVG references the same families the app uses, which is what keeps the document small and readable.

**PNG is not available.** Rasterising needs a canvas, and a stdio process has none — the app does it in the browser. Asking for `format: "png"` is refused with an explanation rather than failing obscurely; export SVG and convert it if you need a bitmap. This is the one documented limitation of the tool.

The rendered document is capped by `MOSAIC_MCP_MAX_EXPORT_BYTES`, and the scene is capped by `MOSAIC_MCP_MAX_SCENE_BYTES` before it is parsed — an export cannot be the way a board the server would refuse to read gets read anyway.

### Writing

Every write tool returns the board's metadata — including the new `sceneVersion` — so a caller can chain writes without re-reading. A successful element write also returns the ids of the elements it created or changed.

#### `create_board`

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | string 1–200 | `"Untitled board"` |  |
| `folderId` | uuid | — | Must be one of your own folders; an unknown or someone else's is refused. |

Returns the new board's `id`, which the element tools need.

#### `rename_board`

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `boardId` | uuid | — | Required. |
| `name` | string 1–200 | — | Required, trimmed, non-empty. |
| `expectedSceneVersion` | int ≥ 0 | — | Optional. Honoured when given, so a model working from a stale listing is told. |

A rename does not touch the scene, so it cannot clobber an edit — which is why the version is optional here and required on the element tools.

#### `duplicate_board`

| Input     | Type         | Default               | Notes              |
| --------- | ------------ | --------------------- | ------------------ |
| `boardId` | uuid         | —                     | The board to copy. |
| `name`    | string 1–200 | `"<original> (copy)"` | Name for the copy. |

The copy carries the scene, its byte count and the thumbnail under a new id. It is unfiled and unfavourited, matching the dashboard's Duplicate: duplicating should not silently clone organisational decisions.

#### `add_element`

Adds one element to a board.

| Input | Type | Notes |
| --- | --- | --- |
| `boardId` | uuid | Required. |
| `expectedSceneVersion` | int ≥ 0 | Required. See [the version rule](#the-scene_version-rule). |
| `element` | object | A discriminated union on `type`. |

The element types, and the fields each accepts:

| `type` | Geometry | Type-specific |
| --- | --- | --- |
| `rectangle` | `x`, `y`, `width`, `height` | — |
| `ellipse` | `x`, `y`, `width`, `height` | — |
| `arrow` | `x`, `y`, `width`, `height` | `points`, `startArrowhead`, `endArrowhead` |
| `text` | `x`, `y` | `text`, `fontSize`, `fontFamily`, `textAlign`, `verticalAlign` |
| `stickynote` | `x`, `y`, optional `width`, `height` | `text`, `author`, `tags` |
| `frame` | `x`, `y`, `width`, `height` | `name` |

All six accept the same optional style fields: `strokeColor`, `backgroundColor`, `fillStyle`, `strokeWidth`, `strokeStyle`, `roughness`, `opacity`, `angle`, `locked`, `link`.

Every branch is `.strict()`: an unknown field is an error, not noise. Coordinates and sizes must be finite and within ±1,000,000 — `Infinity` would poison every derived bound in the scene, and JSON cannot carry it anyway.

A sticky note with a body becomes **two** elements: the note and the label bound to it. That is how the editor models it, and the note is fitted around the label with the editor's own layout function, so a long body shrinks the font or grows the card rather than overflowing.

#### `update_element`

Changes one element's geometry, style, text or frame name.

| Input | Type | Notes |
| --- | --- | --- |
| `boardId` | uuid | Required. |
| `elementId` | string | Required. |
| `expectedSceneVersion` | int ≥ 0 | Required. |
| `changes` | object | Any of `x`, `y`, `width`, `height`, the style fields, `text`, `name`. |

Only the fields you name are replaced. `text` is refused on an element that has none, and `name` on anything that is not a frame — the message says which. Text is re-measured, and a sticky note's label is re-fitted around its new body.

`width` and `height` mean different things per element kind, because they do in the editor too:

| Kind | What a resize does |
| --- | --- |
| rectangle, ellipse, frame | Writes the box. A shape carrying a bound label also re-wraps it, and grows taller if the label no longer fits. |
| arrow, line | Rescales the points, so the drawn line and the box stay in agreement. |
| stickynote | Sets the box and re-fits the label inside it; a height also becomes the note's `baseHeight`. |
| text | **Refused.** A text element's box is its measured text; change `text` instead. |

A bound label is the case `insert_diagram` makes common: every node it draws is a shape with a text element bound through `containerId`, wrapped to the shape's inner width. Narrowing the shape without re-wrapping would leave the label hanging outside it, so the label is re-fitted the same way the editor's handle drag does it — and the shape grows to hold the label rather than clipping it.

An arrow whose points are bound to a shape, or an elbow arrow whose path is generated from its bindings, is refused rather than half-resized: its endpoints are not its own to move.

#### `move_element`

| Input                                          | Type   | Notes             |
| ---------------------------------------------- | ------ | ----------------- |
| `boardId`, `elementId`, `expectedSceneVersion` |        | Required.         |
| `x`, `y`                                       | number | The new position. |

Size, style and content are untouched. To resize, use `update_element`.

Moving a container takes its contents with it: a sticky note's label and a frame's children move by the same amount, which is what dragging one in the editor does. Moving a label or a child on its own is also allowed, and moves only that element.

#### `delete_element`

| Input                                          | Type | Notes     |
| ---------------------------------------------- | ---- | --------- |
| `boardId`, `elementId`, `expectedSceneVersion` |      | Required. |

The element is **marked** deleted, exactly as the app's own delete does — it stays in the scene so undo still works and stored indices keep their meaning. `get_board` counts deleted elements separately.

Deleting follows the app's own rules for what cannot outlive an element:

- a **container's bound label** is deleted with it — a label is not an element in its own right, and left behind it would render loose on the canvas;
- a **frame's children** are _not_ deleted: their `frameId` is cleared and they stay on the board, because a frame is a grouping rather than a container;
- an **elbow arrow bound** to the deleted element loses that binding, because its path is generated from the shapes it connects.

#### `insert_diagram`

Draws a diagram from code and inserts it into a board.

| Input | Type | Notes |
| --- | --- | --- |
| `boardId` | uuid | Required. |
| `expectedSceneVersion` | int ≥ 0 | Required. |
| `type` | `flowchart` \| `architecture` \| `erd` \| `sequence` | Which language the code is in. |
| `code` | string 1–20,000 | The diagram, one statement per line. |
| `x`, `y` | number | Optional origin. Defaults to the right of existing content. |

The code is the same language the diagram pane in the app uses:

```
api: API server
db: Database
api > db: reads
```

The arrow is `>` (and `<` for the reverse, `<>` for both ways); `->` is not an arrow token and would be read as part of the label. In `architecture` a colon is part of the label, so `api: API server` names one node called "API server"; in `erd` the colon splits the node's name from its fields.

The layout is the existing engine — `parseDiagram`, `layoutDiagram` and `reconcileDiagram` from `packages/excalidraw/components/diagram` — not a second implementation, so a diagram made by a tool is the same diagram the pane would make.

**Hand-drawn elements are left untouched.** The engine's rule is that a diagram owns the elements it tagged and nothing else, so shapes, text and arrows you drew survive an insert. The consequence is that **a board holds one diagram**: inserting a second replaces the first, because a node's identity is its slug and two diagrams would collide on it. That is why the tool is annotated `destructiveHint: true`.

Two things the scene layer handles for you:

- **Icons bring their files.** An icon is an image, and an image is nothing without the file its `fileId` names. The files are merged into the scene additively, so a board's other images survive.
- **The diagram does not land on existing work.** With no origin given it is placed to the right of whatever is already on the board; `x`/`y` override that.

Parse errors refuse the whole call rather than inserting what parsed, and the message carries the parser's line numbers.

#### `apply_dsl`

Applies diagram code to a board, updating the diagram it already has **in place**.

| Input | Type | Notes |
| --- | --- | --- |
| `boardId` | uuid | Required. |
| `expectedSceneVersion` | int ≥ 0 | Required. |
| `type` | `flowchart` \| `architecture` \| `erd` \| `sequence` | Which language the code is in. |
| `code` | string 1–20,000 | The diagram, one statement per line. |
| `x`, `y` | number | Optional. Defaults to where the diagram already is. |

The same engine as `insert_diagram` — `reconcileDiagram` is what does the work — with two differences that matter when you are _editing_ rather than creating:

- **The diagram does not move unless you say so.** The default origin is the corner the diagram already occupies, so changing one label and re-applying changes that label and nothing else. `insert_diagram` places a new diagram to the right of the board's content, which is right for a first insert and wrong for an edit.
- **Nodes that still exist keep their element ids.** `reconcileDiagram` keys the existing elements by their diagram tags and passes the ids through, so an arrow bound to a node stays bound and a selection in the editor survives. Nodes the new code no longer mentions are removed.

Hand-drawn elements are untouched, exactly as they are for `insert_diagram`. Applying the same code twice leaves the same diagram in the same place, which is why the tool is `idempotentHint: true` — and why the round trip below works.

#### `insert_template`

Inserts one of the repo's built-in templates or diagram examples.

| Input | Type | Notes |
| --- | --- | --- |
| `boardId` | uuid | Required. |
| `expectedSceneVersion` | int ≥ 0 | Required. |
| `template` | string 1–200 | An id (`kanban-board`) or a name (`Kanban Board`). |
| `x`, `y` | number | Optional corner. Defaults to the right of existing content. |

**32 board templates and 61 diagram examples** are available — the same catalogues the gallery uses (`templates/catalogue.ts` and `templates/diagrams/`), built by the same builder (`templates/builder.ts`). A template inserted by this tool is the same set of elements the gallery inserts: same labels, same bindings, same sticky-note fitting.

The lookup tries the id exactly first, then the name case- and accent-insensitively. An unknown reference is refused with the closest names, and nothing is written.

Two things the scene layer handles:

- **Fresh ids.** A template's elements carry ids derived from its specs, so inserting the same template twice would put two elements with one id on the board. The inserted group is renumbered as a whole, and the references _inside_ it are repaired with it — `frameId`, `containerId`, `boundElements`, `startBinding`, `endBinding` — so a frame's children stay in their frame and a connector stays attached.
- **Placement.** The template's own coordinates start wherever its author drew them, so the elements are shifted to the requested corner, or to the right of whatever is already on the board.

Nothing is replaced: a template is added beside what is there. The tool is `destructiveHint: true` anyway, because adding elements to a board a person is looking at is a change they should be asked about.

The catalogues are loaded lazily — `await import()` inside the call, cached for the life of the process — so a session that never inserts a template never reads them. esbuild only splits dynamic imports, which is what keeps them out of `dist/index.js` and in chunks of their own.

## The `scene_version` rule

Every element write requires `expectedSceneVersion`, and a stale value fails the call:

```
Board 3f2a… is at scene_version 12, but this call expected 9. Nothing was
written — someone has edited the board since you read it. Re-read it with
get_board and try again.
```

This is optimistic concurrency, and it is the same token the editor already uses (`scene_version` in the schema, `baseVersion` in `saveBoardScene`). A successful write bumps `scene_version` and `updated_at`, and the new value comes back in the result.

There is no "force" flag. The only caller that wants one is a caller that is about to destroy someone's work.

The check happens twice: once before the elements are built, so a stale call fails early with a good message, and once in the `UPDATE`'s `WHERE`, which is what closes the window between the read and the write. If the second check fails the caller is told the board changed mid-call rather than being told it succeeded.

## Safety, stated plainly

The server holds a database credential, so it can reach every row that credential can reach. The properties below are enforced **in this process**, not by the database.

- **Owner scoping on every statement.** The scope fragment comes from `ownerScope` in `api/_owner.ts` — the same function every HTTP API route uses — so the MCP server cannot drift from the API's rule. A board that exists but belongs to someone else is reported as "no board with that id", never as "forbidden": a different answer would confirm the id exists.
- **A version guard on every scene write.** See above.
- **A size cap before the write.** A scene above `MOSAIC_MCP_MAX_SCENE_BYTES` is refused, so the server cannot write a board it would then refuse to read. The check is on the serialised string and happens before the `UPDATE`.
- **A scene that cannot be parsed is refused, not replaced.** Writing an empty scene over a corrupt one would turn "this board is broken" into "this board is empty", which is worse and irreversible.
- **A size cap before every parse, too.** `export_board` and `scene_to_dsl` refuse a scene above `MOSAIC_MCP_MAX_SCENE_BYTES` before parsing it, and `export_board` caps the document it returns — a read cannot be the way an oversized board is loaded anyway.
- **Everything not being changed is preserved verbatim.** The parsed document is spread back out on serialisation, so a top-level key this server has never heard of survives a write. The one exception is `appState.collaborators`, which is a live `Map` and must never be persisted.

Anyone who can edit the client's `mcpServers` config can point the server at a different identity or a different database, and read or write what that credential allows. That is acceptable for a local, single-operator tool. If you need per-person isolation, run one server per person with a credential that can only reach that person's rows — do not try to fix it in this config.

## Configuration

All configuration is environment variables, because a stdio server is launched by the client rather than by a shell that has your `.env` loaded.

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Neon/Postgres connection string for the Mosaic database. |
| `MOSAIC_USER_ID` | one of | — | Signed-in account id (`users.id`). Boards are scoped by `user_id`. |
| `MOSAIC_OWNER_UID` | one of | — | Anonymous session uid. Boards are scoped by `owner_uid`, unclaimed only. |
| `MOSAIC_MCP_MAX_TEXT_LENGTH` | no | `500` | Longest single piece of text returned. |
| `MOSAIC_MCP_MAX_ELEMENTS` | no | `50` | Most elements described when `includeElements` is set. |
| `MOSAIC_MCP_MAX_SCENE_BYTES` | no | `8388608` | Largest scene the server will parse, and largest it will write. |
| `MOSAIC_MCP_MAX_EXPORT_BYTES` | no | `16777216` | Largest SVG `export_board` will return. |

Exactly one of `MOSAIC_USER_ID` / `MOSAIC_OWNER_UID` must be set. The server refuses to start otherwise: with no identity it could only return nothing, or — far worse — everything. Setting both is also an error, because the two scope different rows and silently preferring one would show the wrong boards.

Numeric options must be positive decimal integers. A malformed value is a startup error rather than a silent fallback, so a typo cannot leave you debugging a cap that is not the one you configured.

## How it reads data, and why

**The server reads and writes the database directly**, using `DATABASE_URL` plus a configured owner identity. It does not call the Mosaic HTTP API.

The API is same-origin and cookie-authenticated: a request is identified by a signed `mosaic_uid` cookie, or by a `mosaic_session` cookie resolving to `users.id`. A local stdio process has neither. The alternatives were:

1. **Talk to the database directly.** Chosen.
2. **Mint a `mosaic_uid` cookie and call the API.** Rejected. Minting an identity requires `COOKIE_SECRET`, and doing so is forging a credential: the server would be impersonating a browser rather than acting as itself. It would also tie a local tool to a deployed host being reachable.
3. **Add API-key auth to the web API.** Rejected for this phase. It is the change with the largest blast radius — a new auth surface on a public endpoint.

### Owner scoping

Scoping is not reimplemented here. `packages/mcp/src/owner.ts` imports `ownerScope` from `api/_owner.ts` — the same function every API route uses — so the MCP server cannot drift from the HTTP API's rule. Every query takes its `WHERE` fragment from that function; none builds one by hand.

- Signed in: `b.user_id = $n`
- Anonymous: `b.owner_uid = $n AND b.user_id IS NULL`

The second clause is what makes a guest claim final: a captured guest cookie stops granting access the moment the rows are claimed.

### Elements are built by the editor's own code

Nothing hand-writes an element object. `add_element` calls `newElement`, `newTextElement`, `newStickyNoteElement`, `newArrowElement` and `newFrameElement` — the same constructors the editor's tools call — so a server-made element has the same fields, defaults and invariants as one drawn by hand.

That code needs to measure text, and the editor's default measurement provider uses a `<canvas>`, which a Node process does not have. `src/textMetrics.ts` installs an estimate at module load, and every module that builds an element imports it for the side effect, so it does not matter which of them a caller reaches first. The estimate is deliberately generous, because the app does **not** re-measure stored text on load: the width written here is the width the editor draws, so a slight over-estimate leaves slack while an under-estimate would spill out of its container.

## Example prompts

Once configured, these are the kinds of things the tools are shaped for:

**Reading**

- "List my ten most recent boards."
- "What's on the board called Architecture Review? Summarise it in five bullets."
- "Which boards mention 'deploy'? Show me the excerpt from each."
- "Do I have any boards in the trash?"
- "How big is my biggest board — how many elements and roughly what area?"
- "Find every board with a code block in it."
- "Export the Architecture Review board as an SVG and save it next to my notes."
- "What does the diagram on the payments board actually say? Give me it as code."

**Writing**

- "Create a board called Q3 Planning and put a sticky note on it that says 'Ship the migration'."
- "On the Architecture Review board, add a text element at the top saying 'Draft — do not share', then add a red rectangle around the database box."
- "Rename the board called 'Untitled board' to 'Payments flow'."
- "Duplicate the onboarding board and call the copy 'Onboarding v2'."
- "Draw an architecture diagram on the Q3 board: a browser talking to an API, the API reading from Postgres and writing to Redis."
- "Make a flowchart for the refund process: request received → validate → approved or rejected → notify."
- "Delete the arrow I added earlier — it's the second element from the top."
- "Move that sticky note to the right of the diagram so it doesn't overlap."
- "On the Q3 board, rename the 'Postgres' node to 'Postgres 16' in the diagram and leave everything else where it is."
- "Read the diagram on the onboarding board as code, add a step for email verification, and apply it back."
- "Start a new board from the Kanban Board template."
- "Put the 'Blog Entity Relationship Diagram' example on the data-model board."

## Development

```bash
yarn --cwd packages/mcp test        # vitest
yarn --cwd packages/mcp typecheck   # tsc --noEmit
yarn --cwd packages/mcp build       # esbuild -> dist/index.js
```

The tests need no database. They drive the tool bodies against a fake database, which is where the properties that matter live: every statement is owner-scoped, no listing selects `scene`, a stale version writes nothing, and a scene over the cap is refused before the `UPDATE`. The element and diagram tests assert on the **stored scene** — what a person opening the board would see — rather than on the SQL alone.

## Layout

| File | Responsibility |
| --- | --- |
| `src/index.ts` | MCP adapter: registers the tools, validates input, serialises output. |
| `src/tools.ts` | The three metadata read tool bodies, as plain functions over a database handle. |
| `src/writeTools.ts` | The write tool bodies, and the shared read-modify-write they go through. |
| `src/db.ts` | Read queries, and the data-path decision in its module comment. |
| `src/writes.ts` | Every `INSERT` / `UPDATE` / `DELETE`, kept in one file to review. |
| `src/sceneEdit.ts` | Reading, changing and re-serialising a stored scene; element construction. |
| `src/diagram.ts` | The adapter between the diagram engine and a stored scene. |
| `src/sceneToDsl.ts` | Reading a stored scene back out as diagram code, and the skipped list. |
| `src/exportBoard.ts` | Rendering a board to SVG through the app's export pipeline. |
| `src/dom.ts` | The jsdom globals and canvas shim the export needs in a Node process. |
| `src/templates.ts` | Lazy template catalogues, name-or-id lookup, and placement. |
| `src/textMetrics.ts` | Text measurement for a process with no canvas. |
| `src/scene.ts` | The scene summariser and its caps. |
| `src/schemas.ts` | zod input schemas and the search helpers. |
| `src/owner.ts` | Bridges the configured identity to `api/_owner.ts`. |
| `src/config.ts` | Environment parsing. |
