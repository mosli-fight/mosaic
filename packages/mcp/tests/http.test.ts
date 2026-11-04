import { describe, expect, it } from "vitest";

import { DEFAULT_OPTIONS } from "../src/config.js";
import { handleHttpRequest } from "../src/http.js";

import type { Database } from "../src/db.js";
import type { OwnerIdentity } from "../src/config.js";

/**
 * Tests for the streamable HTTP transport.
 *
 * These drive the real MCP server over the real transport, with a fake
 * database. That is the level that catches the failures that matter for a
 * transport change: a tool that answers over stdio but not over HTTP, a
 * session id that leaks into a stateless response, a GET that opens a
 * stream instead of being refused.
 *
 * Authentication is not tested here — it lives in `apiKeys.ts` and is
 * tested there. The owner that reaches this layer has already been resolved
 * from a key; what is pinned here is that it is the owner the tools are
 * scoped to.
 */

const user: OwnerIdentity = { kind: "user", userId: "user-123" };
const otherUser: OwnerIdentity = { kind: "user", userId: "user-999" };

const config = {
  databaseUrl: "postgres://user:pass@example.test/db",
  owner: user,
  options: DEFAULT_OPTIONS,
};

type Call = { text: string; params: unknown[] };

/** A database that answers every registered tool query with one row. */
const fakeDatabase = (): { db: Database; calls: Call[] } => {
  const calls: Call[] = [];
  const db: Database = {
    query: async (text, params = []) => {
      calls.push({ text, params });
      if (text.startsWith("SELECT count(*)")) {
        return [{ total: 0 }];
      }
      if (text.includes("FROM boards") || text.includes("FROM folders")) {
        return [];
      }
      return [];
    },
  };
  return { db, calls };
};

const initializeBody = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "0.0.0" },
  },
};

const post = async (
  db: Database,
  owner: OwnerIdentity,
  body: unknown,
  method = "POST",
) =>
  handleHttpRequest(config, db, { owner, method, body });

describe("handleHttpRequest", () => {
  it("answers an initialize request with a valid MCP response", async () => {
    const { db } = fakeDatabase();

    const response = await post(db, user, initializeBody);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      result?: { protocolVersion?: string };
    };
    expect(payload.result?.protocolVersion).toBeTruthy();
  });

  it("runs a tool call over HTTP", async () => {
    const { db, calls } = fakeDatabase();

    // Stateless mode has no session, so the tools/call goes straight in.
    const response = await post(db, user, initializeBody);
    expect(response.status).toBe(200);

    const toolResponse = await post(db, user, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_boards", arguments: {} },
    });

    expect(toolResponse.status).toBe(200);
    const payload = (await toolResponse.json()) as {
      result?: { content?: { text?: string }[] };
    };
    const text = payload.result?.content?.[0]?.text ?? "";
    expect(text).toContain("boards");

    // The call was scoped to the authenticated owner.
    const expectedParam = user.kind === "user" ? user.userId : user.ownerUid;
    expect(calls.some((call) => call.params.includes(expectedParam))).toBe(
      true,
    );
  });

  it("scopes a tool call to the key's owner, not the configured owner", async () => {
    const { db, calls } = fakeDatabase();

    await post(db, otherUser, initializeBody);
    await post(db, otherUser, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_boards", arguments: {} },
    });

    const otherParam = otherUser.kind === "user" ? otherUser.userId : null;
    expect(
      calls.some((call) => call.text.includes("b.user_id") && call.params.includes(otherParam)),
    ).toBe(true);
  });

  it("issues no session id in stateless mode", async () => {
    const { db } = fakeDatabase();

    const response = await post(db, user, initializeBody);

    expect(response.headers.get("mcp-session-id")).toBeNull();
  });

  it("refuses GET rather than opening a stream", async () => {
    const { db } = fakeDatabase();

    const response = await post(db, user, null, "GET");

    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
  });

  it("refuses DELETE", async () => {
    const { db } = fakeDatabase();

    const response = await post(db, user, null, "DELETE");

    expect(response.status).toBe(405);
  });

  it("refuses other methods", async () => {
    const { db } = fakeDatabase();

    const response = await post(db, user, null, "PUT");

    expect(response.status).toBe(405);
  });

  it("does not require a session between requests", async () => {
    const { db } = fakeDatabase();

    // Two independent requests, neither carrying a session id, both succeed.
    const first = await post(db, user, initializeBody);
    const second = await post(db, user, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_boards", arguments: {} },
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});
