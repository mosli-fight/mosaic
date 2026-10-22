import { describe, expect, it } from "vitest";

import {
  parseDiagram,
  renameNodeInCode,
  slugify,
} from "../components/diagram/parser";

/**
 * The DSL the diagram pane is written in.
 *
 * The parser is the contract between what a person types and what the
 * canvas draws, so these tests are about the language itself: what a line
 * means, what an attribute does, and — just as important — what happens
 * when a line is wrong.
 */

describe("slugify", () => {
  it("folds a label into a stable identity", () => {
    expect(slugify("API Gateway")).toBe("api-gateway");
    expect(slugify("  Login   Service ")).toBe("login-service");
    expect(slugify("users")).toBe("users");
  });

  it("drops punctuation rather than encoding it", () => {
    expect(slugify("Auth / Service (v2)")).toBe("auth-service-v2");
    expect(slugify("???")).toBe("");
  });
});

describe("parseDiagram: nodes", () => {
  it("reads one node per line, labelled by the line", () => {
    const { model, errors } = parseDiagram(
      "Login Service\nDatabase",
      "flowchart",
    );

    expect(errors).toEqual([]);
    expect(model.nodes.map((node) => node.label)).toEqual([
      "Login Service",
      "Database",
    ]);
    expect(model.nodes.map((node) => node.id)).toEqual([
      "login-service",
      "database",
    ]);
  });

  it("keeps the line number of each node", () => {
    const { model } = parseDiagram("\n# comment\nA\n\nB", "flowchart");

    expect(model.nodes.map((node) => node.line)).toEqual([3, 5]);
  });

  it("reads attributes in brackets and keeps them off the label", () => {
    const { model } = parseDiagram(
      "API Gateway [icon: server] [color: blue]",
      "architecture",
    );

    expect(model.nodes[0]).toMatchObject({
      label: "API Gateway",
      icon: "server",
      color: "blue",
    });
  });

  it("reads a shape attribute", () => {
    const { model } = parseDiagram("Cache [shape: ellipse]", "architecture");

    expect(model.nodes[0].shape).toBe("ellipse");
  });

  it("does not crash on an unknown attribute, and keeps the label", () => {
    const { model, errors } = parseDiagram(
      "Worker [frobnicate: yes] [icon: gear]",
      "architecture",
    );

    expect(errors).toEqual([]);
    expect(model.nodes[0].label).toBe("Worker");
    expect(model.nodes[0].icon).toBe("gear");
  });

  it("does not crash on a bare attribute with no value", () => {
    const { model, errors } = parseDiagram("Worker [urgent]", "flowchart");

    expect(errors).toEqual([]);
    expect(model.nodes[0].label).toBe("Worker");
  });

  it("leaves an unclosed bracket in the label rather than eating the line", () => {
    const { model } = parseDiagram("Worker [icon: gear", "flowchart");

    expect(model.nodes[0].label).toBe("Worker [icon: gear");
  });

  it("treats a repeated label as the same node", () => {
    const { model } = parseDiagram("API\nAPI [color: blue]", "flowchart");

    expect(model.nodes).toHaveLength(1);
    expect(model.nodes[0].color).toBe("blue");
  });
});

describe("parseDiagram: comments and blank lines", () => {
  it("ignores comments and blank lines", () => {
    const { model, errors } = parseDiagram(
      "# a comment\n\n   \n# another\nNode",
      "flowchart",
    );

    expect(errors).toEqual([]);
    expect(model.nodes).toHaveLength(1);
  });

  it("does not treat a # inside a label as a comment", () => {
    const { model } = parseDiagram("Issue #42", "flowchart");

    expect(model.nodes[0].label).toBe("Issue #42");
  });
});

describe("parseDiagram: edges", () => {
  it("reads a directed arrow", () => {
    const { model, errors } = parseDiagram(
      "Web App > API Gateway",
      "flowchart",
    );

    expect(errors).toEqual([]);
    expect(model.edges).toHaveLength(1);
    expect(model.edges[0]).toMatchObject({
      from: "web-app",
      to: "api-gateway",
      both: false,
    });
  });

  it("points the reverse arrow at the node written first", () => {
    const { model } = parseDiagram("A < B", "flowchart");

    // the arrowhead is next to A, so the edge runs B → A
    expect(model.edges[0]).toMatchObject({ from: "b", to: "a", both: false });
  });

  it("reads the reverse arrow written with a tail", () => {
    const { model } = parseDiagram("A -< B", "flowchart");

    expect(model.edges[0]).toMatchObject({ from: "b", to: "a", both: false });
  });

  it("keeps the reverse arrow's spans on the side they were written", () => {
    const { model } = parseDiagram("A < B", "flowchart");
    const edge = model.edges[0];

    // `from` is B, which sits on the right of the line
    expect("A < B".slice(edge.fromStart, edge.fromEnd)).toBe("B");
    expect("A < B".slice(edge.toStart, edge.toEnd)).toBe("A");
  });

  it("reads a two-way arrow", () => {
    const { model } = parseDiagram("A <> B", "flowchart");

    expect(model.edges[0]).toMatchObject({ from: "a", to: "b", both: true });
  });

  it("declares the nodes an edge names", () => {
    const { model } = parseDiagram("Web App > API Gateway", "flowchart");

    expect(model.nodes.map((node) => node.id).sort()).toEqual([
      "api-gateway",
      "web-app",
    ]);
    expect(model.nodes.every((node) => node.implicit)).toBe(true);
  });

  it("lets a later explicit line take over an implicit node", () => {
    const { model } = parseDiagram(
      "Web App > API Gateway\nAPI Gateway [icon: gateway]",
      "architecture",
    );

    const gateway = model.nodes.find((node) => node.id === "api-gateway")!;

    expect(gateway.implicit).toBe(false);
    expect(gateway.icon).toBe("gateway");
    expect(gateway.line).toBe(2);
  });

  it("keeps a label written after the target", () => {
    const { model } = parseDiagram("Client > Server: request", "sequence");

    expect(model.edges[0]).toMatchObject({
      from: "client",
      to: "server",
      label: "request",
    });
  });

  it("does not read an arrow out of an attribute", () => {
    const { model, errors } = parseDiagram(
      "Gateway [icon: a>b]",
      "architecture",
    );

    expect(errors).toEqual([]);
    expect(model.edges).toHaveLength(0);
    expect(model.nodes[0].label).toBe("Gateway");
  });

  it("draws the same edge once", () => {
    const { model } = parseDiagram("A > B\nA > B", "flowchart");

    expect(model.edges).toHaveLength(1);
  });

  it("treats the two directions of a two-way edge as one edge", () => {
    const { model } = parseDiagram("A <> B\nB <> A", "flowchart");

    expect(model.edges).toHaveLength(1);
  });
});

describe("parseDiagram: groups", () => {
  it("reads a brace block and puts its lines in it", () => {
    const { model, errors } = parseDiagram(
      "Backend {\n  Auth Service\n  Database\n}",
      "architecture",
    );

    expect(errors).toEqual([]);
    expect(model.groups).toHaveLength(1);
    expect(model.groups[0].label).toBe("Backend");
    expect(model.nodes.map((node) => node.groupId)).toEqual([
      "backend",
      "backend",
    ]);
  });

  it("nests groups", () => {
    const { model, errors } = parseDiagram(
      "Backend {\n  Data {\n    Postgres\n  }\n}",
      "architecture",
    );

    expect(errors).toEqual([]);
    expect(model.groups.map((group) => group.depth)).toEqual([0, 1]);
    expect(model.groups[1].parentId).toBe("backend");
    expect(model.nodes[0].groupId).toBe(model.groups[1].id);
  });

  it("reports an unclosed group", () => {
    const { errors } = parseDiagram("Backend {\n  Auth", "architecture");

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });

  it("reports a closing brace with nothing to close", () => {
    const { errors } = parseDiagram("}", "architecture");

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });
});

describe("parseDiagram: ERD fields", () => {
  it("reads fields after the colon", () => {
    const { model } = parseDiagram("users: id, name, email", "erd");

    expect(model.nodes[0]).toMatchObject({
      label: "users",
      fields: ["id", "name", "email"],
    });
  });

  it("does not split fields for other diagram types", () => {
    const { model } = parseDiagram("users: id, name", "flowchart");

    expect(model.nodes[0].label).toBe("users: id, name");
    expect(model.nodes[0].fields).toEqual([]);
  });

  it("does not split a colon inside an attribute", () => {
    const { model } = parseDiagram("users [color: blue]: id, name", "erd");

    expect(model.nodes[0].label).toBe("users");
    expect(model.nodes[0].fields).toEqual(["id", "name"]);
  });

  it("reads an edge between tables", () => {
    const { model } = parseDiagram("users > orders", "erd");

    expect(model.edges).toHaveLength(1);
    expect(model.nodes.map((node) => node.id)).toEqual(["users", "orders"]);
  });
});

describe("parseDiagram: malformed lines", () => {
  it("reports an edge with a missing side", () => {
    const { errors } = parseDiagram("A >", "flowchart");

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });

  it("reports a line that is only attributes", () => {
    const { errors } = parseDiagram("[icon: server]", "flowchart");

    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });

  it("reports a name with no letters or digits, rather than dropping it", () => {
    // a line that produced neither a node nor an error would look like an
    // empty diagram, and the caller would clear the board
    const { model, errors } = parseDiagram("}}}}", "flowchart");

    expect(model.nodes).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].line).toBe(1);
  });

  it("reports each bad line with its own number, and still reads the good ones", () => {
    const { model, errors } = parseDiagram("Good\nA >\nAlso good", "flowchart");

    expect(errors.map((error) => error.line)).toEqual([2]);
    expect(model.nodes.map((node) => node.label)).toEqual([
      "Good",
      "Also good",
    ]);
  });

  it("never throws on arbitrary text", () => {
    const inputs = [
      ">>>>",
      "[[[[",
      "}{",
      "a>b>c",
      "\u0000\u0001",
      "A { B { C",
      ":",
      "[]",
    ];

    for (const input of inputs) {
      expect(() => parseDiagram(input, "flowchart")).not.toThrow();
    }
  });
});

describe("renameNodeInCode", () => {
  it("rewrites the label in place and leaves the rest of the line alone", () => {
    const code = "API Gateway [icon: server] [color: blue]";

    expect(
      renameNodeInCode(code, "api-gateway", "Edge Gateway", "architecture"),
    ).toBe("Edge Gateway [icon: server] [color: blue]");
  });

  it("leaves comments and other lines untouched", () => {
    const code = "# a comment\nWeb App\nWeb App > API";

    expect(renameNodeInCode(code, "web-app", "Browser", "flowchart")).toBe(
      "# a comment\nBrowser\nBrowser > API",
    );
  });

  it("renames the node an edge declared", () => {
    const code = "Web App > API";

    expect(renameNodeInCode(code, "api", "Gateway", "flowchart")).toBe(
      "Web App > Gateway",
    );
  });

  it("does nothing for a node that is not in the code", () => {
    expect(renameNodeInCode("A", "nope", "B", "flowchart")).toBe(null);
  });

  it("renames the right side of a reverse arrow", () => {
    // the edge runs B → A, but each name still has to be spliced where it
    // was written, not where the arrow points
    expect(renameNodeInCode("A < B", "a", "Alpha", "flowchart")).toBe(
      "Alpha < B",
    );
    expect(renameNodeInCode("A < B", "b", "Beta", "flowchart")).toBe(
      "A < Beta",
    );
  });

  it("does nothing for an empty or unchanged label", () => {
    expect(renameNodeInCode("A", "a", "   ", "flowchart")).toBe(null);
    expect(renameNodeInCode("A", "a", "A", "flowchart")).toBe(null);
  });
});
