import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { BoardCard } from "@/components/board/BoardCard";
import { storage } from "@/lib/storage";
import { useDashboardStore } from "@/state/useDashboardStore";

/**
 * The "Delete forever" confirmation.
 *
 * This is the only menu action on a board card that cannot be undone and is not
 * recoverable from the trash, and it used to fire on the menu click. These tests
 * drive the real store over the real IndexedDB adapter, so they also prove the row
 * really survives until the dialog is confirmed.
 */

const boardId = "11111111-2222-4333-8444-555555555555";

const makeBoard = () => ({
  id: boardId,
  name: "Roadmap",
  folderId: null,
  favorite: false,
  trashedAt: null,
  thumbnail: null,
  sceneVersion: 0,
  createdAt: Date.now() - 60_000,
  updatedAt: Date.now() - 60_000,
  lastOpenedAt: null,
});

const renderCard = (isTrashView = false) =>
  render(
    <MemoryRouter>
      <BoardCard
        board={makeBoard()}
        selected={false}
        isTrashView={isTrashView}
        onToggleSelect={() => {}}
        onRangeSelect={() => {}}
      />
    </MemoryRouter>,
  );

/** Open the card's overflow menu and click one of its items. */
const clickMenuItem = (testId: string) => {
  fireEvent.click(screen.getByTestId(`menu-${boardId}`));
  fireEvent.click(screen.getByTestId(testId));
};

beforeEach(async () => {
  await storage.createBoard({ id: boardId, name: "Roadmap" });
  await useDashboardStore.getState().reload();
});

describe("delete forever confirmation", () => {
  it("asks first instead of deleting on the menu click", async () => {
    renderCard();

    clickMenuItem("menu-delete-forever");

    const dialog = await screen.findByTestId("modal");
    expect(dialog).toHaveAttribute("aria-label", "Delete this board forever?");
    // The board is named, so the user is confirming *this* board and not "a board".
    expect(dialog).toHaveTextContent("Roadmap");

    // …and the row is still in storage.
    expect(await storage.getBoard(boardId)).toBeDefined();
  });

  it("deletes nothing when the dialog is cancelled", async () => {
    renderCard();

    clickMenuItem("menu-delete-forever");
    fireEvent.click(await screen.findByTestId("modal-cancel"));

    await waitFor(() =>
      expect(screen.queryByTestId("modal")).not.toBeInTheDocument(),
    );
    expect(await storage.getBoard(boardId)).toBeDefined();
  });

  it("deletes the board once the dialog is confirmed", async () => {
    renderCard();

    clickMenuItem("menu-delete-forever");
    fireEvent.click(await screen.findByTestId("modal-confirm"));

    await waitFor(async () =>
      expect(await storage.getBoard(boardId)).toBeUndefined(),
    );
  });

  it("offers the same confirmation for a board already in the trash", async () => {
    renderCard(true);

    clickMenuItem("menu-delete-forever");

    expect(await screen.findByTestId("modal")).toBeInTheDocument();
    expect(await storage.getBoard(boardId)).toBeDefined();
  });

  it("leaves the board alone when Escape dismisses the dialog", async () => {
    renderCard();

    clickMenuItem("menu-delete-forever");
    fireEvent.keyDown(window, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByTestId("modal")).not.toBeInTheDocument(),
    );
    expect(await storage.getBoard(boardId)).toBeDefined();
  });

  it("still trashes without a dialog, so recovery stays cheap", async () => {
    renderCard();

    clickMenuItem("menu-trash");

    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
    await waitFor(async () => {
      expect((await storage.getBoard(boardId))?.trashedAt).not.toBeNull();
    });
  });
});
