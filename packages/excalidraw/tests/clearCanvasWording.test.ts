import { describe, expect, it } from "vitest";

import en from "../locales/en.json";

/**
 * Wording invariant for the clear-canvas action.
 *
 * The menu item was labelled `buttons.clearReset` ("Reset the canvas") while the
 * confirmation dialog it opens is titled `clearCanvasDialog.title` ("Clear
 * canvas"). Clicking an item and being asked to confirm a differently-named thing
 * reads as two actions, and "reset" also suggests something recoverable, which
 * clearing the canvas is not. The action's own label key, `labels.clearCanvas`, was
 * already "Clear canvas" - so this makes the one straggler agree with both.
 *
 * Asserted on the dictionary rather than on rendered output because the two
 * strings live in different files (a menu item and a dialog) and the rendered
 * versions are only reachable by opening a menu and a modal.
 */
describe("clear canvas wording", () => {
  it("names the menu item and its confirmation dialog the same", () => {
    expect(en.buttons.clearReset).toBe(en.clearCanvasDialog.title);
  });

  it("agrees with the action's own label", () => {
    expect(en.buttons.clearReset).toBe(en.labels.clearCanvas);
  });

  it("says 'Clear canvas' rather than 'Reset the canvas'", () => {
    expect(en.buttons.clearReset).toBe("Clear canvas");
  });

  it("still warns that the work is lost", () => {
    // Renaming the action must not soften its consequence.
    expect(en.alerts.clearReset).toMatch(/clear the whole canvas/i);
    expect(en.alerts.clearReset).toMatch(/sure\?/i);
  });
});
