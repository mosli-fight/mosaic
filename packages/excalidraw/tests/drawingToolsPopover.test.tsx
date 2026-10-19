import { vi } from "vitest";

import { Excalidraw } from "../index";

import { act, fireEvent, render, waitFor } from "./test-utils";

const openPopover = async (container: HTMLElement) => {
  fireEvent.click(container.querySelector('[data-testid="toolbar-freedraw"]')!);
  await waitFor(() =>
    expect(document.querySelector(".drawing-tools-popover-content")).not.toBe(
      null,
    ),
  );
};

const trigger = (container: HTMLElement) =>
  container.querySelector('[data-testid="toolbar-freedraw"]')!;

const option = (type: string) =>
  document.querySelector<HTMLButtonElement>(
    `.drawing-tools-popover-content [data-testid="toolbar-${type}"]`,
  )!;

/**
 * Identifies an icon by its path data. Comparing `outerHTML` would be
 * fragile: React re-applies attributes in diff order, so the same icon can
 * serialize with its attributes in a different order after an update.
 */
const iconPaths = (root: Element) =>
  Array.from(root.querySelectorAll("svg path")).map((path) =>
    path.getAttribute("d"),
  );

/** the icon the trigger currently displays */
const triggerIcon = (container: HTMLElement) => iconPaths(trigger(container));

describe("lasso in the drawing-tools popover", () => {
  it("renders the lasso option last, after the precision eraser", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    const optionIds = Array.from(
      document.querySelectorAll(
        '.drawing-tools-popover-content [data-testid^="toolbar-"]',
      ),
    ).map((entry) => entry.getAttribute("data-testid"));

    expect(optionIds).toEqual([
      "toolbar-freedraw",
      "toolbar-highlighter",
      "toolbar-autoshape",
      "toolbar-laser",
      "toolbar-eraser",
      "toolbar-precisionEraser",
      "toolbar-lasso",
    ]);
  });

  it("activates the lasso tool when picked", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    const setActiveTool = vi.spyOn(window.h.app, "setActiveTool");

    try {
      fireEvent.click(option("lasso"));

      expect(setActiveTool).toHaveBeenCalledWith({ type: "lasso" });
      expect(window.h.state.activeTool.type).toBe("lasso");
    } finally {
      setActiveTool.mockRestore();
    }
  });

  it("checks the lasso option and shows it on the trigger", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    const lassoIcon = iconPaths(option("lasso"));
    expect(option("lasso").getAttribute("aria-pressed")).toBe("false");
    expect(triggerIcon(container)).not.toEqual(lassoIcon);

    fireEvent.click(option("lasso"));

    await waitFor(() =>
      expect(option("lasso").getAttribute("aria-pressed")).toBe("true"),
    );
    // the trigger remembers lasso as the last-used drawing tool
    expect(triggerIcon(container)).toEqual(lassoIcon);
    expect(trigger(container).getAttribute("aria-pressed")).toBe("true");
    // and the other options are unchecked
    expect(option("freedraw").getAttribute("aria-pressed")).toBe("false");
    expect(option("precisionEraser").getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("picks up a lasso activated outside the popover", async () => {
    const { container } = await render(<Excalidraw />);

    act(() => {
      window.h.app.setActiveTool({ type: "lasso" });
    });

    await openPopover(container);

    expect(triggerIcon(container)).toEqual(iconPaths(option("lasso")));
    expect(option("lasso").getAttribute("aria-pressed")).toBe("true");
  });

  it("re-activates the remembered lasso when the trigger is clicked", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    fireEvent.click(option("lasso"));
    expect(window.h.state.activeTool.type).toBe("lasso");

    // leave the tool, then re-open through the trigger — it re-selects the
    // option it displays
    act(() => {
      window.h.app.setActiveTool({ type: "selection" });
    });
    await waitFor(() =>
      expect(triggerIcon(container)).toEqual(iconPaths(option("lasso"))),
    );

    fireEvent.click(trigger(container));
    expect(window.h.state.activeTool.type).toBe("lasso");
  });

  it("disables the lasso option while another tool is host-forced", async () => {
    const { container, rerender } = await render(<Excalidraw />);
    await openPopover(container);

    rerender(<Excalidraw activeTool={{ type: "rectangle" }} />);

    await waitFor(() => expect(option("lasso").disabled).toBe(true));
  });
});

describe("smart drawing in the drawing-tools popover", () => {
  it("renders the smart-drawing option 3rd, after the highlighter", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    const optionIds = Array.from(
      document.querySelectorAll(
        '.drawing-tools-popover-content [data-testid^="toolbar-"]',
      ),
    ).map((entry) => entry.getAttribute("data-testid"));

    expect(optionIds.indexOf("toolbar-autoshape")).toBe(2);
    expect(optionIds[1]).toBe("toolbar-highlighter");
    expect(optionIds[3]).toBe("toolbar-laser");
  });

  it("activates the autoshape tool when picked", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    const setActiveTool = vi.spyOn(window.h.app, "setActiveTool");

    try {
      fireEvent.click(option("autoshape"));

      expect(setActiveTool).toHaveBeenCalledWith({ type: "autoshape" });
      expect(window.h.state.activeTool.type).toBe("autoshape");
    } finally {
      setActiveTool.mockRestore();
    }
  });

  it("checks the smart-drawing option and shows it on the trigger", async () => {
    const { container } = await render(<Excalidraw />);
    await openPopover(container);

    const autoshapeIcon = iconPaths(option("autoshape"));
    expect(option("autoshape").getAttribute("aria-pressed")).toBe("false");
    expect(triggerIcon(container)).not.toEqual(autoshapeIcon);

    fireEvent.click(option("autoshape"));

    await waitFor(() =>
      expect(option("autoshape").getAttribute("aria-pressed")).toBe("true"),
    );
    // the trigger remembers smart drawing as the last-used drawing tool
    expect(triggerIcon(container)).toEqual(autoshapeIcon);
    expect(trigger(container).getAttribute("aria-pressed")).toBe("true");
    // and the other options are unchecked
    expect(option("freedraw").getAttribute("aria-pressed")).toBe("false");
    expect(option("highlighter").getAttribute("aria-pressed")).toBe("false");
  });

  it("disables the smart-drawing option while another tool is host-forced", async () => {
    const { container, rerender } = await render(<Excalidraw />);
    await openPopover(container);

    rerender(<Excalidraw activeTool={{ type: "rectangle" }} />);

    await waitFor(() => expect(option("autoshape").disabled).toBe(true));
  });
});
