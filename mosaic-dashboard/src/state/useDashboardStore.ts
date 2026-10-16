import { create } from "zustand";

import type {
  Activity,
  Board,
  BoardSort,
  Folder,
  FolderColor,
} from "@/db/schema";

import { storage } from "@/lib/storage";

/**
 * Single Zustand store for the dashboard.
 *
 * Why one store instead of several: every view is a projection of the same three
 * tables, and splitting them means a rename in the sidebar and a rename in the
 * grid could transiently disagree. A single store plus one `reload` gives a
 * simple consistency guarantee — after any mutation the whole UI re-derives from
 * IndexedDB.
 *
 * IndexedDB stays the source of truth; this store is only a cache of the last
 * read. Mutations go through `storage` and then call `reload()`, so there
 * is exactly one code path that writes.
 */

type LoadState = "idle" | "loading" | "ready" | "error";

/**
 * How to re-read from storage.
 *
 * `background` is the difference between "I have nothing to show, go fetch" and
 * "what I am showing may be out of date, refresh it without taking the screen
 * away". Without it, re-reading on navigation tore the grid down on every click
 * and put a skeleton back up, which is worse than the staleness it fixed.
 */
export type ReloadOptions = { background?: boolean };

type DashboardState = {
  boards: Board[];
  folders: Folder[];
  activity: Activity[];

  loadState: LoadState;
  error: string | null;
  /**
   * True once a read has completed at least once, whatever it returned.
   *
   * `loadState` cannot answer "have we ever loaded?" on its own: `idle` is the
   * pre-first-read state and `ready` is the steady state, but a page that renders
   * the moment it mounts sees `idle` and cannot tell "no boards yet" apart from
   * "not loaded yet" — which is exactly how the dashboard used to greet a returning
   * user with "No boards yet / 0 boards" for a second before filling in.
   */
  hasLoaded: boolean;

  /** UI-only view state, not persisted. */
  selectedIds: string[];
  query: string;
  sort: BoardSort;

  reload: (options?: ReloadOptions) => Promise<void>;

  // board actions
  createBoard: (name?: string) => Promise<Board>;
  renameBoard: (id: string, name: string) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  duplicateBoard: (id: string) => Promise<void>;
  moveBoardToFolder: (id: string, folderId: string | null) => Promise<void>;
  trashBoard: (id: string) => Promise<void>;
  restoreBoard: (id: string) => Promise<void>;
  deleteBoardForever: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;

  // folder actions
  createFolder: (name?: string, color?: FolderColor) => Promise<Folder>;
  renameFolder: (id: string, name: string) => Promise<void>;
  recolorFolder: (id: string, color: FolderColor) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;

  // selection + view state
  toggleSelected: (id: string) => void;
  selectMany: (ids: string[]) => void;
  clearSelection: () => void;
  setQuery: (query: string) => void;
  setSort: (sort: BoardSort) => void;
};

/**
 * Wrap a mutation so the store refreshes afterwards and errors surface in the UI
 * rather than becoming unhandled rejections. Every action below goes through it.
 *
 * `set` is threaded in rather than captured from `create`'s closure so this
 * helper can be defined at module scope, outside the store factory.
 */
const withReload =
  <A extends unknown[], R>(
    set: (fn: (state: DashboardState) => Partial<DashboardState>) => void,
    get: () => DashboardState,
    fn: (...args: A) => Promise<R>,
  ) =>
  async (...args: A): Promise<R> => {
    try {
      const result = await fn(...args);
      await get().reload();
      return result;
    } catch (error) {
      // Surfacing the message lets the Shell render a banner instead of the app
      // silently pretending the write succeeded.
      set(() => ({
        error: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  };

export const useDashboardStore = create<DashboardState>((set, get) => {
  /**
   * Monotonic token for in-flight reads.
   *
   * Two reads can overlap — the boot read and a navigation refresh, or a refresh
   * that lands while a mutation's own reload is still running. Without this the
   * slower one wins and writes older rows over newer ones, which is a visible
   * regression from a silent one, so the loser is discarded instead.
   */
  let latestRead = 0;

  return {
    boards: [],
    folders: [],
    activity: [],
    loadState: "idle",
    error: null,
    hasLoaded: false,

    selectedIds: [],
    query: "",
    sort: "recent",

    reload: async ({ background = false }: ReloadOptions = {}) => {
      const ticket = (latestRead += 1);
      // A background refresh leaves `loadState` alone: the rows already on screen
      // stay on screen until better ones arrive, which is the whole point.
      if (!background) {
        set({ loadState: "loading" });
      }
      try {
        // `includeTrashed` is true here because the trash page needs the same
        // array; `selectBoards` is what scopes views down to live boards.
        const [boards, folders, activity] = await Promise.all([
          storage.listBoards({ includeTrashed: true }),
          storage.listFolders(),
          storage.listActivity(),
        ]);
        if (ticket !== latestRead) {
          return;
        }
        set({
          boards,
          folders,
          activity,
          loadState: "ready",
          hasLoaded: true,
          error: null,
        });
      } catch (error) {
        if (ticket !== latestRead) {
          return;
        }
        set({
          loadState: "error",
          hasLoaded: true,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },

    createBoard: withReload(set, get, (name?: string) =>
      storage.createBoard({ name }),
    ),
    renameBoard: withReload(set, get, (id: string, name: string) =>
      storage.renameBoard(id, name).then(() => undefined),
    ),
    toggleFavorite: withReload(set, get, (id: string) =>
      storage.toggleFavorite(id).then(() => undefined),
    ),
    duplicateBoard: withReload(set, get, (id: string) =>
      storage.duplicateBoard(id).then(() => undefined),
    ),
    moveBoardToFolder: withReload(
      set,
      get,
      (id: string, folderId: string | null) =>
        storage.moveBoardToFolder(id, folderId).then(() => undefined),
    ),
    trashBoard: withReload(set, get, (id: string) => storage.trashBoard(id)),
    restoreBoard: withReload(set, get, (id: string) =>
      storage.restoreBoard(id),
    ),
    deleteBoardForever: withReload(set, get, (id: string) =>
      storage.deleteBoardForever(id),
    ),
    emptyTrash: withReload(set, get, () => storage.emptyTrash()),

    createFolder: withReload(set, get, (name?: string, color?: FolderColor) =>
      storage.createFolder({
        ...(name !== undefined ? { name } : {}),
        ...(color !== undefined ? { color } : {}),
      }),
    ),
    renameFolder: withReload(set, get, (id: string, name: string) =>
      storage.renameFolder(id, name).then(() => undefined),
    ),
    recolorFolder: withReload(set, get, (id: string, color: FolderColor) =>
      storage.recolorFolder(id, color).then(() => undefined),
    ),
    deleteFolder: withReload(set, get, (id: string) =>
      storage.deleteFolder(id),
    ),

    toggleSelected: (id: string) =>
      set((state) => ({
        selectedIds: state.selectedIds.includes(id)
          ? state.selectedIds.filter((x) => x !== id)
          : [...state.selectedIds, id],
      })),

    selectMany: (ids: string[]) => set({ selectedIds: ids }),

    clearSelection: () => set({ selectedIds: [] }),

    setQuery: (query: string) => set({ query }),
    setSort: (sort: BoardSort) => set({ sort }),
  };
});
