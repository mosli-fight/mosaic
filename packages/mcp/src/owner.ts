/**
 * Owner scoping for the MCP server's database reads.
 *
 * ## Why this module exists rather than importing `api/_owner.ts` directly
 *
 * The scoping rule itself is *not* reimplemented here — it is imported from
 * `api/_owner.ts`, the same module the HTTP API uses. There is exactly one
 * definition of "which rows may this caller see", and a change to it changes
 * both surfaces together.
 *
 * What this module adds is the part the HTTP module cannot supply: turning an
 * explicitly configured identity into the `Actor` shape that rule expects.
 * `api/_owner.ts` derives an `Actor` from a cookie-bearing request, which a
 * stdio process does not have.
 *
 * ## The rule, restated because getting it wrong is a data leak
 *
 * - **Signed in** (`userId`): scope by `user_id = $n`. Never by `owner_uid`.
 *   A claimed board keeps its original `owner_uid` (the column is `NOT NULL`),
 *   so scoping a signed-in caller by that value would show them a different set
 *   of rows than the web app does.
 * - **Anonymous** (`ownerUid`): scope by `owner_uid = $n AND user_id IS NULL`.
 *   The `user_id IS NULL` half is what makes a claim final — without it, a
 *   captured guest uid would keep granting access to rows now owned by an
 *   account.
 */

import { ownerScope } from "../../../api/_owner.js";

import type { OwnerIdentity } from "./config.js";

import type { Actor } from "../../../api/_owner.js";

/**
 * Converts the configured identity into the `Actor` `ownerScope` expects.
 *
 * The unused half is left empty, exactly as `resolveActor` does for a signed-in
 * request (`ownerUid: ""`). That is not cosmetic: `ownerScope` branches on
 * `userId` alone, so an empty `ownerUid` can never be substituted into a query
 * by accident.
 */
export const actorFor = (owner: OwnerIdentity): Actor =>
  owner.kind === "user"
    ? { userId: owner.userId, ownerUid: "" }
    : { userId: null, ownerUid: owner.ownerUid };

/**
 * The `WHERE` fragment and parameters that scope a `boards` query.
 *
 * Delegates to `ownerScope` so the SQL text is identical to the API's, down to
 * the `AND user_id IS NULL` guard. Returned as a small object rather than a
 * bare string so a caller cannot forget the parameters that go with it.
 *
 * `startAt` is passed through for queries that spend `$1` on something else —
 * Postgres infers one type per placeholder, so reusing `$1` for both a uuid id
 * and a text owner is a runtime error, not a style issue.
 */
export const boardScope = (
  owner: OwnerIdentity,
  startAt = 1,
): { sql: string; params: unknown[]; placeholder: string } =>
  ownerScope(actorFor(owner), "b", startAt);

/**
 * A human-readable description of whose data is being read.
 *
 * Used in the `list_boards` reply so the model (and the person reading the
 * transcript) can tell which identity answered. It deliberately does not
 * include the uid itself for a user — an account id is not a secret, but it is
 * also not useful here, and printing it invites it into logs and screenshots.
 */
export const describeOwner = (owner: OwnerIdentity): string =>
  owner.kind === "user" ? "signed-in account" : "anonymous session";
