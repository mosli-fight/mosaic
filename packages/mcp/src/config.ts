/**
 * Environment configuration for the Mosaic MCP server.
 *
 * Everything the server needs comes from the environment, because a stdio MCP
 * server is launched by the *client* (Claude Desktop, an IDE) rather than by a
 * shell that has the project's `.env` loaded. The client's `mcpServers` entry is
 * therefore the configuration surface, and it is documented in the README and
 * `claude-desktop.example.json`.
 *
 * ## Why the server talks to Postgres instead of the HTTP API
 *
 * The web API is same-origin and identifies the caller with a signed
 * `mosaic_uid` cookie or a `mosaic_session` cookie. A local stdio process has
 * neither: it cannot mint a cookie (that needs `COOKIE_SECRET`, and minting one
 * would be forging an identity), and there is no API-key path to add without
 * opening a new auth surface on a public endpoint. Reading the same database
 * with the same scoping rule is the least invasive correct option; the
 * trade-offs are in the README.
 *
 * The consequence for this module is that the *owner identity is explicit*: it
 * is not discovered from a request, it is configured. That is why
 * {@link loadConfig} refuses to start without one — a server with no identity
 * would have to either return nothing or, far worse, return everything.
 */

/** Env vars this server reads. Documented in the README's configuration table. */
export const ENV = {
  databaseUrl: "DATABASE_URL",
  ownerUid: "MOSAIC_OWNER_UID",
  userId: "MOSAIC_USER_ID",
  maxTextLength: "MOSAIC_MCP_MAX_TEXT_LENGTH",
  maxElements: "MOSAIC_MCP_MAX_ELEMENTS",
  maxSceneBytes: "MOSAIC_MCP_MAX_SCENE_BYTES",
} as const;

/**
 * The identity every query is scoped by.
 *
 * Exactly one of `userId` / `ownerUid` is set, mirroring `Actor` in
 * `api/_owner.ts`: a signed-in account is scoped by `user_id` *only*, an
 * anonymous one by `owner_uid` *and* `user_id IS NULL`. Keeping the same shape
 * is what lets the server reuse `ownerScope` verbatim instead of re-deriving the
 * rule — a second copy of that predicate is a second place for it to drift.
 */
export type OwnerIdentity =
  | { kind: "user"; userId: string }
  | { kind: "guest"; ownerUid: string };

export type ServerOptions = {
  /**
   * Longest single piece of text returned per element.
   *
   * Scenes can hold a whole markdown document in one text element; a summary
   * that returned it verbatim would be as large as the scene it summarises.
   */
  maxTextLength: number;
  /** Most elements described individually when a caller asks for the list. */
  maxElements: number;
  /**
   * Largest scene the server will parse at all.
   *
   * `get_board` reads one scene to summarise it. A scene above this size is
   * reported as "too large to summarise" rather than loaded, which keeps a
   * pathological board from turning a tool call into a multi-second stall.
   */
  maxSceneBytes: number;
};

export type Config = {
  databaseUrl: string;
  owner: OwnerIdentity;
  options: ServerOptions;
};

/** Thrown when the environment cannot produce a usable configuration. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Parses a positive integer env var, falling back when unset.
 *
 * A malformed value is an error rather than a silent fallback: someone who
 * writes `MOSAIC_MCP_MAX_ELEMENTS=lots` believes they changed the limit, and
 * quietly ignoring it would leave them debugging a cap that is not the one they
 * configured.
 */
const positiveInt = (
  raw: string | undefined,
  fallback: number,
  name: string,
): number => {
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  // Decimal digits only: `Number("0x10")` is 16 and `Number("1e3")` is 1000,
  // neither of which is what someone writing a byte count means.
  const value = Number(raw);
  if (!/^\d+$/.test(raw.trim()) || !Number.isSafeInteger(value) || value <= 0) {
    throw new ConfigError(`${name} must be a positive integer, got "${raw}"`);
  }
  return value;
};

/** Defaults chosen so the largest possible `get_board` reply stays small. */
export const DEFAULT_OPTIONS: ServerOptions = {
  maxTextLength: 500,
  maxElements: 50,
  maxSceneBytes: 8 * 1024 * 1024,
};

/**
 * Builds the configuration, or explains precisely what is missing.
 *
 * Errors are collected rather than thrown one at a time so a first run reports
 * every problem in one go — being told about `DATABASE_URL`, restarting, and
 * then being told about the owner identity is a bad first experience.
 */
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const problems: string[] = [];

  const databaseUrl = env[ENV.databaseUrl]?.trim() ?? "";
  if (!databaseUrl) {
    problems.push(
      `${ENV.databaseUrl} is not set — the server reads boards directly from ` +
        "the same Neon database the web app uses.",
    );
  }

  const userId = env[ENV.userId]?.trim() ?? "";
  const ownerUid = env[ENV.ownerUid]?.trim() ?? "";

  if (userId && ownerUid) {
    // Both would be ambiguous: the two identities scope different rows, and
    // silently preferring one would show the wrong set of boards.
    problems.push(
      `Set only one of ${ENV.userId} or ${ENV.ownerUid}. A signed-in account ` +
        "is scoped by user id; an anonymous session by its owner uid.",
    );
  } else if (!userId && !ownerUid) {
    problems.push(
      `Set ${ENV.userId} (signed-in account) or ${ENV.ownerUid} (anonymous ` +
        "session). The server will not run without an owner identity: it has " +
        "no way to know whose boards it may read.",
    );
  }

  let options: ServerOptions = DEFAULT_OPTIONS;
  try {
    options = {
      maxTextLength: positiveInt(
        env[ENV.maxTextLength],
        DEFAULT_OPTIONS.maxTextLength,
        ENV.maxTextLength,
      ),
      maxElements: positiveInt(
        env[ENV.maxElements],
        DEFAULT_OPTIONS.maxElements,
        ENV.maxElements,
      ),
      maxSceneBytes: positiveInt(
        env[ENV.maxSceneBytes],
        DEFAULT_OPTIONS.maxSceneBytes,
        ENV.maxSceneBytes,
      ),
    };
  } catch (error) {
    problems.push((error as Error).message);
  }

  if (problems.length > 0) {
    throw new ConfigError(
      `Mosaic MCP server is not configured:\n${problems
        .map((problem) => `  - ${problem}`)
        .join("\n")}`,
    );
  }

  return {
    databaseUrl,
    owner: userId ? { kind: "user", userId } : { kind: "guest", ownerUid },
    options,
  };
};
