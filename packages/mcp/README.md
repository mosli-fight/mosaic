# `@mosaic/mcp`

A read-only [Model Context Protocol](https://modelcontextprotocol.io) server for Mosaic boards. It lets a model list your boards, read a compact summary of what is on one, and search across them — over stdio, from Claude Desktop or any other MCP client.

There are no write tools. That is not a permission flag: the package contains no `INSERT`, `UPDATE` or `DELETE` statement, and the database module exposes only three read queries.

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

Restart the client. The server writes `[mosaic-mcp] ready — reading boards for signed-in account (read-only)` to stderr when it has connected; stderr is the client's log, and is the only place this server ever writes diagnostics.

## Tools

All three tools are annotated `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, `openWorldHint: false`.

### `list_boards`

Lists boards, most recently used first. **Metadata only** — the scene is never selected by this query, so a listing cannot leak board content however large it is.

| Input | Type | Default | Notes |
| --- | --- | --- | --- |
| `limit` | int 1–100 | `20` | Page size. |
| `offset` | int ≥ 0 | `0` | Boards to skip. |
| `includeTrashed` | boolean | `false` | Include soft-deleted boards. |
| `folderId` | uuid | — | Only boards in this folder. |
| `unfiled` | boolean | `false` | Only boards in no folder. Ignored with a folder id. |

Each board is returned as `id`, `name`, `folderId`, `folderName`, `favorite`, `trashed`, `sceneVersion`, `createdAt`, `updatedAt`, `lastOpenedAt`, `sceneBytes`. The response also carries `total`, `limit`, `offset` and `hasMore`, so a caller can page without guessing from a short page.

### `get_board`

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

### `search_boards`

Matches board **names** and the **text inside scenes**.

| Input            | Type     | Default | Notes                       |
| ---------------- | -------- | ------- | --------------------------- |
| `query`          | string   | —       | 1–200 characters, required. |
| `limit`          | int 1–50 | `20`    | Maximum matches.            |
| `includeTrashed` | boolean  | `false` | Also search the trash.      |

Each match reports `matchedOn` (`name`, `content`, or both) and a short `excerpts` list around each content hit. Name matches sort first. The response also reports `boardsSearched` and `boardsSkipped` — a board whose scene is too large to parse is counted as skipped rather than silently reported as a non-match.

Matching is case-insensitive and literal: `$5` matches the text `$5`, and `.*` matches nothing unless a board literally contains `.*`.

## Configuration

All configuration is environment variables, because a stdio server is launched by the client rather than by a shell that has your `.env` loaded.

| Variable | Required | Default | Meaning |
| --- | --- | --- | --- |
| `DATABASE_URL` | yes | — | Neon/Postgres connection string for the Mosaic database. |
| `MOSAIC_USER_ID` | one of | — | Signed-in account id (`users.id`). Boards are scoped by `user_id`. |
| `MOSAIC_OWNER_UID` | one of | — | Anonymous session uid. Boards are scoped by `owner_uid`, unclaimed only. |
| `MOSAIC_MCP_MAX_TEXT_LENGTH` | no | `500` | Longest single piece of text returned. |
| `MOSAIC_MCP_MAX_ELEMENTS` | no | `50` | Most elements described when `includeElements` is set. |
| `MOSAIC_MCP_MAX_SCENE_BYTES` | no | `8388608` | Largest scene the server will parse at all. |

Exactly one of `MOSAIC_USER_ID` / `MOSAIC_OWNER_UID` must be set. The server refuses to start otherwise: with no identity it could only return nothing, or — far worse — everything. Setting both is also an error, because the two scope different rows and silently preferring one would show the wrong boards.

Numeric options must be positive decimal integers. A malformed value is a startup error rather than a silent fallback, so a typo cannot leave you debugging a cap that is not the one you configured.

## How it reads data, and why

**The server reads the database directly**, using `DATABASE_URL` plus a configured owner identity. It does not call the Mosaic HTTP API.

The API is same-origin and cookie-authenticated: a request is identified by a signed `mosaic_uid` cookie, or by a `mosaic_session` cookie resolving to `users.id`. A local stdio process has neither. The alternatives were:

1. **Read the database directly.** Chosen.
2. **Mint a `mosaic_uid` cookie and call the API.** Rejected. Minting an identity requires `COOKIE_SECRET`, and doing so is forging a credential: the server would be impersonating a browser rather than acting as itself. It would also tie a local tool to a deployed host being reachable.
3. **Add API-key auth to the web API.** Rejected for this phase. It is the change with the largest blast radius — a new auth surface on a public endpoint.

### Owner scoping

Scoping is not reimplemented here. `packages/mcp/src/owner.ts` imports `ownerScope` from `api/_owner.ts` — the same function every API route uses — so the MCP server cannot drift from the HTTP API's rule. Every query takes its `WHERE` fragment from that function; none builds one by hand.

- Signed in: `b.user_id = $n`
- Anonymous: `b.owner_uid = $n AND b.user_id IS NULL`

The second clause is what makes a guest claim final: a captured guest cookie stops granting access the moment the rows are claimed.

A board that exists but belongs to someone else is reported as "no board with that id", never as "forbidden". The two are deliberately indistinguishable — a different answer would confirm the id exists.

### The trade-off, stated plainly

The server holds a database credential, so it can read every row that credential can reach. Owner scoping is enforced **in this process**, not by the database. Anyone who can edit the client's `mcpServers` config can point the server at a different identity or a different database, and read what that credential allows.

That is acceptable for a local, single-operator tool, and it is why the server ships with no write path at all: the blast radius of a misconfiguration is "someone read boards they could already read with the credential they supplied". If you need per-person isolation, run one server per person with a credential that can only reach that person's rows — do not try to fix it in this config.

## Example prompts

Once configured, these are the kinds of things the tools are shaped for:

- "List my ten most recent boards."
- "What's on the board called Architecture Review? Summarise it in five bullets."
- "Which boards mention 'deploy'? Show me the excerpt from each."
- "Search my boards for 'onboarding' and tell me which one is the most recent."
- "Do I have any boards in the trash?"
- "How big is my biggest board — how many elements and roughly what area?"
- "Find every board with a code block in it."

## Development

```bash
yarn --cwd packages/mcp test        # vitest
yarn --cwd packages/mcp typecheck   # tsc --noEmit
yarn --cwd packages/mcp build       # esbuild -> dist/index.js
```

The tests need no database. They assert the SQL text and parameters the query layer would send, which is where the two properties that matter live: every query is owner-scoped, and no listing ever selects `scene`.

## Layout

| File | Responsibility |
| --- | --- |
| `src/index.ts` | MCP adapter: registers the tools, validates input, serialises output. |
| `src/tools.ts` | The three tool bodies, as plain functions over a database handle. |
| `src/db.ts` | Queries, and the data-path decision in its module comment. |
| `src/scene.ts` | The scene summariser and its caps. |
| `src/schemas.ts` | zod input schemas and the search helpers. |
| `src/owner.ts` | Bridges the configured identity to `api/_owner.ts`. |
| `src/config.ts` | Environment parsing. |
