import { describe, expect, it } from "vitest";

import { boardScope, actorFor, describeOwner } from "../src/owner.js";

import type { OwnerIdentity } from "../src/config.js";

/**
 * Tests for owner scoping.
 *
 * These assert the *SQL predicate and its parameters*, not behaviour against a
 * database. That is the right level for this check: the guarantee being tested
 * is "the query cannot see another owner's rows", and the only way to be sure of
 * that is to read the clause that will be sent.
 *
 * The predicate itself is imported from `api/_owner.ts` — the same function the
 * web API uses — so these tests also pin the contract the MCP server depends on.
 * If the API's scoping changes shape, these fail rather than the server silently
 * widening its view.
 */

const signedIn: OwnerIdentity = { kind: "user", userId: "user-123" };
const guest: OwnerIdentity = { kind: "guest", ownerUid: "uid-456" };

describe("actorFor", () => {
  it("maps a signed-in owner to a userId actor", () => {
    expect(actorFor(signedIn)).toEqual({ userId: "user-123", ownerUid: "" });
  });

  it("maps a guest owner to an anonymous actor", () => {
    // `userId: null` is what selects the anonymous branch of `ownerScope`.
    expect(actorFor(guest)).toEqual({ userId: null, ownerUid: "uid-456" });
  });
});

describe("boardScope", () => {
  it("scopes a signed-in owner by user_id", () => {
    const scope = boardScope(signedIn);

    expect(scope.sql).toBe("b.user_id = $1");
    expect(scope.params).toEqual(["user-123"]);
    expect(scope.placeholder).toBe("$1");
  });

  it("scopes a guest by owner_uid and excludes claimed boards", () => {
    const scope = boardScope(guest);

    // The `user_id IS NULL` half matters: without it, a guest who knew a
    // signed-in user's uid could read their boards.
    expect(scope.sql).toBe("b.owner_uid = $1 AND b.user_id IS NULL");
    expect(scope.params).toEqual(["uid-456"]);
    expect(scope.placeholder).toBe("$1");
  });

  it("uses the requested placeholder position", () => {
    const scope = boardScope(signedIn, 3);

    expect(scope.sql).toBe("b.user_id = $3");
    expect(scope.params).toEqual(["user-123"]);
    expect(scope.placeholder).toBe("$3");
  });

  it("never emits a predicate that could match every row", () => {
    for (const owner of [signedIn, guest]) {
      const scope = boardScope(owner);
      expect(scope.sql).not.toMatch(/\b1\s*=\s*1\b/);
      expect(scope.sql).not.toMatch(/\bTRUE\b/i);
      expect(scope.params).toHaveLength(1);
      expect(scope.params[0]).toBeTruthy();
    }
  });

  it("puts the owner id in a parameter, never in the SQL text", () => {
    // Interpolation would be an injection risk and would also make the query
    // text differ per owner, defeating prepared-statement caching.
    const scope = boardScope(signedIn);
    expect(scope.sql).not.toContain("user-123");
  });

  it("produces a different predicate for each owner kind", () => {
    expect(boardScope(signedIn).sql).not.toBe(boardScope(guest).sql);
  });
});

describe("describeOwner", () => {
  it("describes an account without printing its id", () => {
    const description = describeOwner(signedIn);
    expect(description).toBe("signed-in account");
    expect(description).not.toContain("user-123");
  });

  it("describes a guest without printing its uid", () => {
    const description = describeOwner(guest);
    expect(description).toBe("anonymous session");
    expect(description).not.toContain("uid-456");
  });
});
