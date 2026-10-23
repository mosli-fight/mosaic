import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";

import { Excalidraw } from "../index";
import { resetDocumentView } from "../components/document/documentViewStore";
import { notesStorageKey } from "../components/document/notesStorage";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

/**
 * The document pane, from the toolbar to the board.
 *
 * The pane is a surface of the editor, so the things that must hold are
 * about the editor as a whole: opening it must not touch the scene, moving
 * between its three views must not lose a word of the notes, and the notes
 * must come back when the same board is opened again.
 */

const getByTestId = (container: HTMLElement, testId: string) =>
  container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

/** opens the pane and waits for its lazily loaded body */
const openPane = async (container: HTMLElement) => {
  act(() => {
    fireEvent.click(getByTestId(container, "toolbar-document")!);
  });

  await waitFor(() => {
    expect(getByTestId(container, "document-pane")).not.toBe(null);
  });
};

/** the notes currently typed into the pane */
const notesOf = (container: HTMLElement) =>
  getByTestId(container, "document-editor") as HTMLTextAreaElement;

/** types into the notes */
const typeNotes = (container: HTMLElement, value: string) => {
  fireEvent.change(notesOf(container), { target: { value } });
};

describe("the document pane", () => {
  beforeEach(() => {
    resetDocumentView();
    window.localStorage.clear();
    window.location.hash = "";
  });

  it("opens from the toolbar and closes again", async () => {
    const { container } = await render(<Excalidraw />);

    expect(getByTestId(container, "document-pane")).toBe(null);

    await openPane(container);

    expect(getByTestId(container, "document-pane")!.dataset.view).toBe("both");

    act(() => {
      fireEvent.click(getByTestId(container, "document-close")!);
    });

    expect(getByTestId(container, "document-pane")).toBe(null);
  });

  it("switches between the three views", async () => {
    const { container } = await render(<Excalidraw />);

    await openPane(container);

    act(() => {
      fireEvent.click(getByTestId(container, "document-view-document")!);
    });
    expect(getByTestId(container, "document-pane")!.dataset.view).toBe(
      "document",
    );

    act(() => {
      fireEvent.click(getByTestId(container, "document-view-canvas")!);
    });
    expect(getByTestId(container, "document-pane")).toBe(null);

    // the canvas view hides the pane, so the way back is the toolbar; it
    // returns to the view the document was last in rather than the default
    await openPane(container);
    expect(getByTestId(container, "document-pane")!.dataset.view).toBe(
      "document",
    );
  });

  it("keeps the notes across every view change", async () => {
    const { container } = await render(<Excalidraw />);

    await openPane(container);
    typeNotes(container, "# My plan\n\n- [ ] one");

    act(() => {
      fireEvent.click(getByTestId(container, "document-view-document")!);
    });
    expect(notesOf(container).value).toBe("# My plan\n\n- [ ] one");

    act(() => {
      fireEvent.click(getByTestId(container, "document-view-canvas")!);
    });
    await openPane(container);

    expect(notesOf(container).value).toBe("# My plan\n\n- [ ] one");
  });

  it("does not disturb the canvas scene", async () => {
    const { container } = await render(<Excalidraw />);

    act(() => {
      API.setElements([
        API.createElement({ type: "rectangle", id: "r1", x: 10, y: 10 }),
      ]);
    });

    const before = h.elements;

    await openPane(container);

    act(() => {
      fireEvent.click(getByTestId(container, "document-view-document")!);
    });
    act(() => {
      fireEvent.click(getByTestId(container, "document-view-canvas")!);
    });
    await openPane(container);

    expect(h.elements).toEqual(before);
    expect(h.state.selectedElementIds).toEqual({});
  });

  it("draws the document as it is typed", async () => {
    const { container } = await render(<Excalidraw />);

    await openPane(container);
    typeNotes(container, "# Title\n\n- [x] done\n\n| a | b |\n| - | - |\n| 1 | 2 |");

    const preview = getByTestId(container, "document-preview")!;

    expect(preview.querySelector("h1")!.textContent).toBe("Title");
    expect(preview.querySelectorAll("input[type=checkbox]")).toHaveLength(1);
    expect(
      (preview.querySelector("input[type=checkbox]") as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(preview.querySelectorAll("table td")).toHaveLength(2);
  });

  it("ticks a checklist item back into the source", async () => {
    const { container } = await render(<Excalidraw />);

    await openPane(container);
    typeNotes(container, "- [ ] one\n- [ ] two");

    act(() => {
      fireEvent.click(getByTestId(container, "document-check-0")!);
    });

    expect(notesOf(container).value).toBe("- [x] one\n- [ ] two");
  });

  it("saves the notes per board and brings them back", async () => {
    const { container, unmount } = await render(<Excalidraw />);

    window.location.hash = "#board=board-a";

    await openPane(container);
    typeNotes(container, "notes for board a");

    // blurring writes immediately rather than waiting for the debounce
    fireEvent.blur(notesOf(container));

    expect(
      window.localStorage.getItem(notesStorageKey("board-a")),
    ).toContain("notes for board a");

    unmount();
    resetDocumentView();

    const second = await render(<Excalidraw />);

    await openPane(second.container);

    expect(notesOf(second.container).value).toBe("notes for board a");
  });

  it("keeps two boards' notes apart", async () => {
    const { container, unmount } = await render(<Excalidraw />);

    window.location.hash = "#board=board-a";
    await openPane(container);
    typeNotes(container, "board a notes");
    fireEvent.blur(notesOf(container));

    unmount();
    resetDocumentView();

    window.location.hash = "#board=board-b";
    const second = await render(<Excalidraw />);
    await openPane(second.container);

    expect(notesOf(second.container).value).not.toBe("board a notes");

    typeNotes(second.container, "board b notes");
    fireEvent.blur(notesOf(second.container));

    expect(
      window.localStorage.getItem(notesStorageKey("board-a")),
    ).toContain("board a notes");
    expect(
      window.localStorage.getItem(notesStorageKey("board-b")),
    ).toContain("board b notes");
  });

  it("toggles with Alt+N", async () => {
    const { container } = await render(<Excalidraw />);

    act(() => {
      fireEvent.keyDown(window, { key: "n", altKey: true });
    });

    await waitFor(() => {
      expect(getByTestId(container, "document-pane")).not.toBe(null);
    });

    act(() => {
      fireEvent.keyDown(window, { key: "n", altKey: true });
    });

    expect(getByTestId(container, "document-pane")).toBe(null);
  });

  it("does not steal Alt+N from a field being typed into", async () => {
    const { container } = await render(<Excalidraw />);

    await openPane(container);

    act(() => {
      fireEvent.keyDown(notesOf(container), { key: "n", altKey: true });
    });

    expect(getByTestId(container, "document-pane")).not.toBe(null);
  });
});
