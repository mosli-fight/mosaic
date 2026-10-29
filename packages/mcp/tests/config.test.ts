import { describe, expect, it } from "vitest";

import {
  ConfigError,
  DEFAULT_OPTIONS,
  ENV,
  loadConfig,
} from "../src/config.js";

/**
 * Tests for environment configuration.
 *
 * The interesting cases are the refusals. A server that starts with no owner
 * identity, or with two, is a server that either returns nothing or returns the
 * wrong owner's boards — so "does not start" is the behaviour worth pinning.
 */

const baseEnv = (): NodeJS.ProcessEnv => ({
  [ENV.databaseUrl]: "postgres://user:pass@example.test/db",
  [ENV.userId]: "user-123",
});

describe("loadConfig", () => {
  it("reads a signed-in configuration", () => {
    const config = loadConfig(baseEnv());

    expect(config.databaseUrl).toBe("postgres://user:pass@example.test/db");
    expect(config.owner).toEqual({ kind: "user", userId: "user-123" });
    expect(config.options).toEqual(DEFAULT_OPTIONS);
  });

  it("reads an anonymous configuration", () => {
    const env = baseEnv();
    delete env[ENV.userId];
    env[ENV.ownerUid] = "uid-456";

    expect(loadConfig(env).owner).toEqual({
      kind: "guest",
      ownerUid: "uid-456",
    });
  });

  it("trims values", () => {
    const env = baseEnv();
    env[ENV.userId] = "  user-123  ";
    env[ENV.databaseUrl] = "  postgres://x/y  ";

    const config = loadConfig(env);
    expect(config.owner).toEqual({ kind: "user", userId: "user-123" });
    expect(config.databaseUrl).toBe("postgres://x/y");
  });

  it("treats a blank value as unset", () => {
    const env = baseEnv();
    env[ENV.userId] = "   ";
    env[ENV.ownerUid] = "uid-456";

    expect(loadConfig(env).owner).toEqual({
      kind: "guest",
      ownerUid: "uid-456",
    });
  });

  it("refuses to start without a database url", () => {
    const env = baseEnv();
    delete env[ENV.databaseUrl];

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/DATABASE_URL is not set/);
  });

  it("refuses to start without an owner identity", () => {
    const env = baseEnv();
    delete env[ENV.userId];

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(
      /will not run without an owner identity/,
    );
  });

  it("refuses to start with both identities set", () => {
    const env = baseEnv();
    env[ENV.ownerUid] = "uid-456";

    expect(() => loadConfig(env)).toThrow(/Set only one of/);
  });

  it("reports every problem at once", () => {
    // A first run should not require three restarts to discover three mistakes.
    const message = (() => {
      try {
        loadConfig({});
      } catch (error) {
        return (error as Error).message;
      }
      return "";
    })();

    expect(message).toMatch(/DATABASE_URL/);
    expect(message).toMatch(/owner identity/);
    expect(
      message.split("\n").filter((line) => line.trim().startsWith("-")),
    ).toHaveLength(2);
  });

  it("reads the numeric options", () => {
    const env = baseEnv();
    env[ENV.maxTextLength] = "120";
    env[ENV.maxElements] = "7";
    env[ENV.maxSceneBytes] = "1024";
    env[ENV.maxExportBytes] = "2048";

    expect(loadConfig(env).options).toEqual({
      maxTextLength: 120,
      maxElements: 7,
      maxSceneBytes: 1024,
      maxExportBytes: 2048,
    });
  });

  it.each([
    ["zero", "0"],
    ["negative", "-1"],
    ["fractional", "1.5"],
    ["not a number", "lots"],
    ["hex", "0x10"],
  ])("rejects a %s numeric option", (_label, raw) => {
    const env = baseEnv();
    env[ENV.maxElements] = raw;

    expect(() => loadConfig(env)).toThrow(ConfigError);
    expect(() => loadConfig(env)).toThrow(/MOSAIC_MCP_MAX_ELEMENTS/);
  });

  it("falls back to the default for a blank numeric option", () => {
    const env = baseEnv();
    env[ENV.maxElements] = "  ";

    expect(loadConfig(env).options.maxElements).toBe(
      DEFAULT_OPTIONS.maxElements,
    );
  });

  it("does not leak the database url into an error message", () => {
    // The error is printed to the client's log, which is often pasted into an
    // issue. A connection string carries a password.
    const env = baseEnv();
    delete env[ENV.userId];

    try {
      loadConfig(env);
    } catch (error) {
      expect((error as Error).message).not.toContain("pass");
    }
  });
});
