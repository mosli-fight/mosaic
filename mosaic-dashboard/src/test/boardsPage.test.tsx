import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, MemoryRouter, Outlet, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/shell/AppShell";
import { BoardsPage } from "@/pages/BoardsPage";
import { storage } from "@/lib/storage";
import { useDashboardStore } from "@/state/useDashboardStore";

/**
 * The board list's loading and count behaviour.
 *
 * Two QA reports, one cause: the page decided what to render from `boards.length`,
 * and `boards` is empty until the first read resolves. So a returning user was
 * told "No boards yet / 0 boards" for roughly a second, and the Favorites page
 * answered "0 boards" right after they had starred something — both were claims
 * about data nobody had fetched yet.
 *
 * These render the real shell, because the shell owns the boot read and the
 * navigation read. Isolating `BoardsPage` would leave it in the skeleton forever
 * and quietly test nothing.
 */

let releaseReads: (() => void) | null = null;

/** Holds the next `listBoards` open so the pre-load render can be observed. */
const blockReads = () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  releaseReads = release;
  return held;
};

const listBoards = storage.listBoards;

/** Routes the shell around the two list views, plus one link to navigate with. */
const renderApp = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          element={
            <AppShell>
              <Link to="/dashboard/favorites" data-testid="to-favorites">
                Favorites
              </Link>
              <Outlet />
            </AppShell>
          }
        >
          <Route path="/dashboard" element={<BoardsPage />} />
          <Route path="/dashboard/favorites" element={<BoardsPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );

const cardIds = () => screen.queryAllByTestId(/^board-card-/);

beforeEach(() => {
  // The store is a module singleton shared across files, so start each case from a
  // known-cold state — which is exactly the state this bug is about.
  useDashboardStore.setState({
    boards: [],
    folders: [],
    activity: [],
    loadState: "idle",
    hasLoaded: false,
    error: null,
    query: "",
    sort: "recent",
    selectedIds: [],
  });
  releaseReads = null;
});

afterEach(() => {
  releaseReads?.();
  releaseReads = null;
  vi.restoreAllMocks();
});

describe("board list loading state", () => {
  it("shows a skeleton rather than the empty state before the first read", async () => {
    const held = blockReads();
    vi.spyOn(storage, "listBoards").mockImplementation(async (options) => {
      await held;
      return listBoards(options);
    });

    renderApp("/dashboard");

    // The empty state is what QA reported: it asserts the user has no boards,
    // which is not yet known and is frequently the opposite of the truth.
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-skeleton")).toBeInTheDocument();
    expect(screen.getByTestId("boards-loading-status")).toHaveTextContent(
      "Loading boards",
    );
    // And the count must not claim zero.
    expect(screen.getByTestId("board-count")).toHaveTextContent("—");

    releaseReads?.();
    await waitFor(() =>
      expect(screen.queryByTestId("board-skeleton")).not.toBeInTheDocument(),
    );
  });

  it("still shows the real empty state once a read finds no boards", async () => {
    renderApp("/dashboard");

    await waitFor(() =>
      expect(screen.getByTestId("empty-state")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("empty-state")).toHaveTextContent(
      "No boards yet",
    );
    expect(screen.getByTestId("board-count")).toHaveTextContent("0 boards");
  });

  it("fills the grid in and counts the rows it found", async () => {
    await storage.createBoard({ name: "Roadmap" });
    await storage.createBoard({ name: "Retro" });

    renderApp("/dashboard");

    await waitFor(() => expect(cardIds()).toHaveLength(2));
    expect(screen.getByTestId("board-count")).toHaveTextContent("2 boards");
    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
  });
});

describe("favorites count", () => {
  it("does not report 0 boards while the first read is still running", async () => {
    const board = await storage.createBoard({ name: "Starred" });
    await storage.toggleFavorite(board.id);

    const held = blockReads();
    vi.spyOn(storage, "listBoards").mockImplementation(async (options) => {
      await held;
      return listBoards(options);
    });

    renderApp("/dashboard/favorites");

    expect(screen.queryByTestId("empty-state")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-count")).not.toHaveTextContent("0 boards");

    releaseReads?.();
    await waitFor(() =>
      expect(screen.getByTestId("board-count")).toHaveTextContent("1 board"),
    );
  });

  it("counts a board starred while the page is open", async () => {
    const board = await storage.createBoard({ name: "Starred" });

    renderApp("/dashboard/favorites");
    await waitFor(() =>
      expect(screen.getByTestId("empty-state")).toBeInTheDocument(),
    );

    // Star it through the store, as the card's star button does.
    await useDashboardStore.getState().toggleFavorite(board.id);

    await waitFor(() => {
      expect(screen.getByTestId("board-count")).toHaveTextContent("1 board");
      expect(screen.getByTestId(`board-card-${board.id}`)).toBeInTheDocument();
    });
  });

  it("shows the star it just took on the Favorites page after a navigation", async () => {
    const starred = await storage.createBoard({ name: "Starred" });
    const plain = await storage.createBoard({ name: "Plain" });
    await storage.toggleFavorite(starred.id);

    renderApp("/dashboard");
    await waitFor(() => expect(cardIds()).toHaveLength(2));

    fireEvent.click(screen.getByTestId("to-favorites"));

    await waitFor(() => {
      expect(cardIds()).toHaveLength(1);
      expect(screen.getByTestId("board-count")).toHaveTextContent("1 board");
      // Only the starred board survives the filter.
      expect(screen.queryByTestId(`board-card-${plain.id}`)).toBeNull();
      expect(
        screen.getByTestId(`star-${starred.id}`).getAttribute("aria-pressed"),
      ).toBe("true");
    });
  });

  it("keeps the previous rows on screen during a background refresh", async () => {
    await storage.createBoard({ name: "Roadmap" });
    renderApp("/dashboard");
    await waitFor(() => expect(cardIds()).toHaveLength(1));

    // A read in flight over data already rendered must not blank the grid; that is
    // the difference between a stale count and a skeleton on every click.
    const held = blockReads();
    vi.spyOn(storage, "listBoards").mockImplementation(async (options) => {
      await held;
      return listBoards(options);
    });
    const pending = useDashboardStore.getState().reload({ background: true });

    expect(useDashboardStore.getState().loadState).toBe("ready");
    expect(cardIds()).toHaveLength(1);
    expect(screen.queryByTestId("board-skeleton")).not.toBeInTheDocument();
    expect(screen.getByTestId("board-count")).toHaveTextContent("1 board");

    releaseReads?.();
    await pending;
  });
});

describe("navigation", () => {
  it("re-reads when the route changes, so counts are not left behind", async () => {
    await storage.createBoard({ name: "Roadmap" });
    renderApp("/dashboard");
    await waitFor(() => expect(cardIds()).toHaveLength(1));

    const spy = vi.spyOn(storage, "listBoards");
    fireEvent.click(screen.getByTestId("to-favorites"));

    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ includeTrashed: true }),
      ),
    );
  });
});
