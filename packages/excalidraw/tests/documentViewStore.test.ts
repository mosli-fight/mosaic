import { describe, expect, it, vi } from "vitest";

import {
  cycleDocumentView,
  DEFAULT_DOCUMENT_VIEW,
  DOCUMENT_VIEWS,
  getDocumentView,
  isDocumentPaneVisible,
  resetDocumentView,
  setDocumentView,
  subscribeDocumentView,
  toggleDocumentPane,
} from "../components/document/documentViewStore";

/**
 * The pane's view.
 *
 * Three states, and the interesting behaviour is at the edges: what a
 * toggle does from each of them, and what a reopen returns to.
 */

describe("the document view store", () => {
  it("starts on the canvas so the pane costs nothing until it is asked for", () => {
    resetDocumentView();

    expect(getDocumentView()).toBe("canvas");
    expect(isDocumentPaneVisible()).toBe(false);
  });

  it("has three views, in toggle order", () => {
    expect(DOCUMENT_VIEWS).toEqual(["document", "both", "canvas"]);
  });

  it("remembers the last view that showed the document", () => {
    resetDocumentView();

    setDocumentView("document");
    toggleDocumentPane();

    expect(getDocumentView()).toBe("canvas");

    toggleDocumentPane();

    expect(getDocumentView()).toBe("document");
  });

  it("opens on the default view when it has never been opened", () => {
    resetDocumentView();

    toggleDocumentPane();

    expect(getDocumentView()).toBe(DEFAULT_DOCUMENT_VIEW);
  });

  it("cycles through the views in order and wraps", () => {
    resetDocumentView();

    setDocumentView("document");
    cycleDocumentView();
    expect(getDocumentView()).toBe("both");

    cycleDocumentView();
    expect(getDocumentView()).toBe("canvas");

    cycleDocumentView();
    expect(getDocumentView()).toBe("document");
  });

  it("notifies its subscribers on a change", () => {
    resetDocumentView();

    const listener = vi.fn();
    const unsubscribe = subscribeDocumentView(listener);

    setDocumentView("both");

    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    setDocumentView("canvas");

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("does not notify when set to the view it is already in", () => {
    resetDocumentView();

    const listener = vi.fn();
    subscribeDocumentView(listener);

    setDocumentView("both");
    setDocumentView("both");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(getDocumentView()).toBe("both");
  });

  it("hides the pane when the canvas view is showing", () => {
    resetDocumentView();

    setDocumentView("document");
    expect(isDocumentPaneVisible()).toBe(true);

    setDocumentView("both");
    expect(isDocumentPaneVisible()).toBe(true);

    setDocumentView("canvas");
    expect(isDocumentPaneVisible()).toBe(false);
  });
});
