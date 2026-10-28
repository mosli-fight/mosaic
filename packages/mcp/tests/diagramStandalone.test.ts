import { describe, expect, it } from "vitest";

import { renderDiagram } from "../src/diagram.js";

/**
 * `diagram.ts` must work on its own.
 *
 * The layout engine measures node labels, and the editor's default measurement
 * provider reaches for `document` — which a stdio server does not have. The
 * provider is installed by `textMetrics.ts` at module load, and every module
 * that builds an element imports it for the side effect.
 *
 * This file deliberately imports nothing else from the package. `writeTools.ts`
 * pulls in `sceneEdit.ts`, which installs the provider too, so a test that went
 * through the tools would pass even if `diagram.ts` had forgotten its import —
 * and the crash would only show up in whichever caller happened to reach
 * `diagram.ts` first. Importing it alone is what makes this a real guard.
 */
describe("diagram.ts in isolation", () => {
  it("lays out a diagram without a document", () => {
    const rendered = renderDiagram(
      [],
      "flowchart TD\n  a[Start] --> b[End]",
      "flowchart",
    );

    expect(rendered.elements.length).toBeGreaterThan(0);
    expect(rendered.bounds.width).toBeGreaterThan(0);
  });
});
