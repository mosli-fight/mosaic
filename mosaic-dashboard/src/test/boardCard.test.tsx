import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import type { Board } from "@/db/schema";
import type { BoardStats } from "@/lib/storage/types";

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

const makeBoard = (over: Partial<Board> = {}) => ({
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
  ...over,
});

const renderCard = (isTrashView = false, over: Partial<Board> = {}) =>
  render(
    <MemoryRouter>
      <BoardCard
        board={makeBoard(over)}
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

describe("relative time on the card", () => {
  const stats = (over: Partial<BoardStats> = {}): BoardStats => ({
    total: 2,
    last7Days: 2,
    lastActivityAt: Date.now(),
    ...over,
  });

  const withStats = (
    isTrashView = false,
    over: Partial<Board> = {},
    s?: BoardStats,
  ) => (
    <MemoryRouter>
      <BoardCard
        board={makeBoard(over)}
        selected={false}
        isTrashView={isTrashView}
        onToggleSelect={() => {}}
        onRangeSelect={() => {}}
        {...(s !== undefined ? { stats: s } : {})}
      />
    </MemoryRouter>
  );

  it("labels a board created minutes ago in minutes, not days", () => {
    render(
      withStats(false, {
        updatedAt: Date.now() - 5 * 60 * 1000,
        lastOpenedAt: null,
      }),
    );

    const age = screen.getByTestId(`age-${boardId}`);
    expect(age).toHaveTextContent(/minute/);
    expect(age).not.toHaveTextContent(/day|week|month|year/);
  });

  it("does not claim a 57-year-old board when the timestamp is unusable", () => {
    render(
      withStats(false, {
        updatedAt: null as never,
        lastOpenedAt: null,
      }),
    );

    expect(screen.getByTestId(`age-${boardId}`)).toHaveTextContent("—");
  });

  it("does not treat a zeroed lastOpenedAt as the epoch", () => {
    render(
      withStats(false, {
        updatedAt: Date.now() - 2 * 60 * 60 * 1000,
        lastOpenedAt: 0,
      }),
    );

    expect(screen.getByTestId(`age-${boardId}`)).toHaveTextContent(/hour/);
  });

  it("puts the exact timestamp in the title", () => {
    const updatedAt = Date.now() - 2 * 60 * 60 * 1000;
    render(withStats(false, { updatedAt, lastOpenedAt: null }));

    expect(screen.getByTestId(`age-${boardId}`).getAttribute("title")).toBe(
      new Date(updatedAt).toLocaleString(),
    );
  });

  it("counts only edits inside the window the chip names", () => {
    // Last touched three months ago: the total is non-zero but the 7-day count is
    // not, so the chip has nothing truthful to say.
    render(
      withStats(
        false,
        { updatedAt: Date.now() - 90 * 24 * 3600 * 1000 },
        stats({
          total: 42,
          last7Days: 0,
        }),
      ),
    );

    expect(screen.queryByTestId(`stats-${boardId}`)).not.toBeInTheDocument();
    expect(screen.getByTestId(`age-${boardId}`)).toHaveTextContent(/month/);
  });

  it("keeps the activity chip distinguishable from the time", () => {
    render(withStats(false, {}, stats({ total: 2, last7Days: 2 })));

    const chip = screen.getByTestId(`stats-${boardId}`);
    expect(chip).toHaveTextContent("2 edits · last 7 days");
    expect(screen.getByTestId(`age-${boardId}`)).not.toHaveTextContent("edits");
  });

  it("says '1 edit' rather than '1 edits'", () => {
    render(withStats(false, {}, stats({ total: 1, last7Days: 1 })));

    expect(screen.getByTestId(`stats-${boardId}`)).toHaveTextContent(
      "1 edit · last 7 days",
    );
  });
});
