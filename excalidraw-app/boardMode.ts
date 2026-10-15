import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

/**
 * "Board mode" — the bridge between the Mosaic dashboard and this editor (Part 2,
 * STEP 6).
 *
 * How the two apps find each other
 * -------------------------------
 * The dashboard navigates the editor to `#board=<id>`. Both apps are served from
 * the same origin by the same nginx, so they share one IndexedDB. The dashboard
 * owns the `mosaic-dashboard` database (via Dexie); this module talks to the same
 * object stores through the *native* IndexedDB API.
 *
 * Why native IndexedDB and not Dexie here:
 * Dexie is not a dependency of `excalidraw-app`, and adding it would (a) change
 * the editor's bundle and (b) risk a schema-version negotiation with an open
 * connection owned by the dashboard. Opening the database without specifying a
 * version always attaches to whatever version already exists, so the editor can
 * never force a re-creation under Dexie's feet.
 *
 * Why nothing here is renamed
 * ---------------------------
 * The DB name, table names and column names are the dashboard's contract, not
 * brand strings. Renaming them would orphan every board a user has already
 * created. See REBRAND.md for the same rule applied to the editor.
 */

/** Object store and database names owned by the dashboard. */
const DB_NAME = "mosaic-dashboard";
const BOARDS_STORE = "boards";

/** Shape of the board rows the dashboard writes. Only the fields we touch. */
type BoardRecord = {
  id: string;
  name?: string;
  scene?: string;
  thumbnail?: string | null;
  sceneVersion?: number;
  updatedAt?: number;
  lastOpenedAt?: number | null;
};

/** Parsed scene, as serialised by `serializeScene` below. */
type StoredScene = {
  elements: unknown[];
  appState: Record<string, unknown>;
  files?: Record<string, unknown>;
};

/**
 * Reads the board id from the URL hash.
 *
 * The hash is already a routing surface for the editor (`#json=`, `#url=`,
 * collaboration tokens), so `#board=` slots into that existing convention rather
 * than inventing a query param. Returns null in normal (non-dashboard) use, which
 * is what keeps the editor's default behaviour completely untouched.
 *
 * `URLSearchParams` is used because `#board=<id>` and `#board=<id>&scene=...`
 * must both parse, and hand-rolled splitting would break on the second form.
 */
export const getBoardIdFromHash = (): string | null => {
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) {
    return null;
  }
  if (!hash.includes("board=")) {
    return null;
  }
  const value = new URLSearchParams(hash).get("board");
  return value && value.length > 0 ? value : null;
};

/** Opens the dashboard database, attaching to the existing version. */
const openBoardDb = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Reads one board row. Resolves to undefined when absent. */
export const readBoardRecord = async (
  boardId: string,
): Promise<BoardRecord | undefined> => {
  const dbi = await openBoardDb();
  try {
    return await new Promise<BoardRecord | undefined>((resolve, reject) => {
      const tx = dbi.transaction(BOARDS_STORE, "readonly");
      const request = tx.objectStore(BOARDS_STORE).get(boardId);
      request.onsuccess = () =>
        resolve(request.result as BoardRecord | undefined);
      request.onerror = () => reject(request.error);
    });
  } finally {
    // Closing releases the connection; without this the dashboard's Dexie
    // instance can be blocked from future version upgrades.
    dbi.close();
  }
};

/**
 * Applies a patch to one board row and returns the new `sceneVersion`.
 *
 * Bumps `sceneVersion` on every write — that counter is the compare-and-set token
 * the dashboard uses to reject a stale autosave, so skipping it would let an old
 * write silently overwrite a newer one.
 */
export const writeBoardRecord = async (
  boardId: string,
  patch: Partial<BoardRecord>,
): Promise<number | undefined> => {
  const dbi = await openBoardDb();
  try {
    return await new Promise<number | undefined>((resolve, reject) => {
      const tx = dbi.transaction(BOARDS_STORE, "readwrite");
      const store = tx.objectStore(BOARDS_STORE);
      const getRequest = store.get(boardId);
      getRequest.onsuccess = () => {
        const current = getRequest.result as BoardRecord | undefined;
        if (!current) {
          // Board was deleted while the editor had it open. Nothing to write.
          resolve(undefined);
          return;
        }
        const nextVersion = (current.sceneVersion ?? 0) + 1;
        const putRequest = store.put({
          ...current,
          ...patch,
          sceneVersion: nextVersion,
          updatedAt: Date.now(),
        });
        putRequest.onsuccess = () => resolve(nextVersion);
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
  } finally {
    dbi.close();
  }
};

/** Records that the board was opened (drives the "recent" sort + activity). */
export const markBoardOpened = async (boardId: string): Promise<void> => {
  // Framed editor: the dashboard opened this board through storage, so the
  // backend has already stamped `lastOpenedAt` (the API does it on the GET).
  // Writing to IndexedDB here would touch a row that does not exist in the API
  // deployment and silently do nothing.
  if (window.parent !== window) {
    return;
  }
  await writeBoardRecord(boardId, { lastOpenedAt: Date.now() });
};

/**
 * Serialises the live scene into the JSON string the dashboard stores.
 *
 * `appState.collaborators` is a `Map` at runtime but JSON.stringify turns a Map
 * into `{}` and leaves behind a value that is not a Map. On rehydrate that value
 * then breaks anything calling `.forEach` / `.size` on it
 * (`e.appState.collaborators.forEach is not a function`). We do not persist
 * collaborators — they are ephemeral presence state tied to a live socket, not
 * scene content — so the field is dropped explicitly rather than left as a
 * corrupt `{}`.
 */
export const serializeScene = (api: ExcalidrawImperativeAPI): string => {
  const { collaborators: _collaborators, ...appState } = api.getAppState();
  return JSON.stringify({
    elements: api.getSceneElements(),
    appState,
    files: api.getFiles(),
  });
};

/**
 * Parses a stored scene string, tolerating malformed/legacy content.
 *
 * Also normalises `appState.collaborators`: it is a `Map` in the editor but was
 * written as JSON, so a scene saved by an older build (or one where the field
 * was not stripped) can arrive as `{}`, `[]` or a string. Handing a non-Map to
 * the editor crashes it on first render. We drop the field entirely —
 * collaborators are ephemeral socket presence and must not be restored from a
 * stored scene anyway — and let `restoreAppState` reinstate a fresh empty Map
 * from its defaults.
 */
export const parseStoredScene = (
  raw: string | undefined,
): StoredScene | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.elements)) {
      const appState = { ...(parsed.appState ?? {}) };
      delete appState.collaborators;
      return { ...parsed, appState } as StoredScene;
    }
    return null;
  } catch {
    // Corrupt row: open an empty board rather than crashing the editor.
    return null;
  }
};

/**
 * Captures a downscaled PNG of the live canvas.
 *
 * Deliberately reads the already-rendered `<canvas>` instead of re-rendering via
 * `exportToBlob`. Two reasons: it captures exactly what the user sees (including
 * the current zoom and any selection chrome is excluded since we re-draw only
 * the canvas bitmap), and it needs no extra imports on the editor side.
 *
 * The canvas backing store can be much larger than the on-screen element (HiDPI),
 * so it is scaled down to THUMBNAIL_MAX_WIDTH before encoding — otherwise a
 * 4K display would produce a multi-megabyte data URL stored in IndexedDB.
 */
const THUMBNAIL_MAX_WIDTH = 480;
const THUMBNAIL_MAX_HEIGHT = 300;

export const captureThumbnail = (): string | null => {
  const canvas = document.querySelector<HTMLCanvasElement>(
    "canvas.excalidraw, canvas",
  );
  if (!canvas) {
    return null;
  }

  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  if (!sourceWidth || !sourceHeight) {
    return null;
  }

  // Preserve aspect ratio while fitting inside the thumbnail box.
  const scale = Math.min(
    THUMBNAIL_MAX_WIDTH / sourceWidth,
    THUMBNAIL_MAX_HEIGHT / sourceHeight,
    1,
  );
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d");
  if (!ctx) {
    return null;
  }
  // Flat white background: the editor canvas is transparent, and a transparent
  // PNG would render as a black rectangle in most dark-mode dashboards.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(canvas, 0, 0, width, height);

  try {
    // JPEG rather than PNG: a whiteboard thumbnail compresses far better as JPEG
    // and IndexedDB quota is the constraint here, not fidelity.
    return target.toDataURL("image/jpeg", 0.72);
  } catch {
    return null;
  }
};

/** How long a framed editor waits for the dashboard to answer a scene request. */
export const LOAD_REQUEST_TIMEOUT_MS = 10_000;

/**
 * Asks the parent dashboard for this board's stored scene.
 *
 * The parent replies with `mosaic:load-board`. It is the only party that knows
 * which backend is in play, so a framed editor never guesses. Resolves to
 * `undefined` on timeout or a message for a different board, which the caller
 * treats exactly like "no stored scene" — an empty canvas is a valid state, and
 * a slow dashboard must not leave the editor stuck on a loading screen.
 */
export const requestSceneFromParent = (
  boardId: string,
): Promise<string | undefined> =>
  new Promise((resolve) => {
    const targetOrigin = window.location.origin;
    let settled = false;

    const finish = (scene?: string) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
      resolve(scene);
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== targetOrigin) {
        return;
      }
      if (event.data?.type !== "mosaic:load-board") {
        return;
      }
      if (event.data?.boardId !== boardId) {
        return;
      }
      finish(event.data.scene ?? undefined);
    };

    const timer = window.setTimeout(
      () => finish(undefined),
      LOAD_REQUEST_TIMEOUT_MS,
    );
    window.addEventListener("message", onMessage);

    try {
      window.parent.postMessage(
        { type: "mosaic:load-board-request", boardId },
        targetOrigin,
      );
    } catch {
      finish(undefined);
    }
  });

/**
 * Tells the dashboard the editor is mounted and able to receive a scene.
 *
 * Best-effort: a standalone editor has no parent to tell, and a failure here
 * costs nothing because the dashboard also hydrates on iframe load.
 */
export const announceBoardReady = (boardId: string): void => {
  if (window.parent === window) {
    return;
  }
  try {
    window.parent.postMessage({ type: "excalidraw/ready", boardId }, "*");
  } catch {
    // A strict CSP can refuse postMessage. The parent retries on iframe load.
  }
};

/** Autosave cadence (matches AUTOSAVE_INTERVAL_MS in the dashboard schema). */
export const AUTOSAVE_INTERVAL_MS = 10_000;

/**
 * How long a framed save waits for the dashboard to confirm the write.
 *
 * Generous on purpose: the production path is a network round trip to the API,
 * and a premature timeout would let the next autosave tick start a second write
 * while the first is still in flight.
 */
export const SAVE_ACK_TIMEOUT_MS = 15_000;

/**
 * Wires autosave for one board: a periodic timer, a save on tab hide, a save on
 * Ctrl/Cmd+S, and a save on unload.
 *
 * Returns a disposer. Every trigger funnels through one `runSave`, which is
 * guarded by an in-flight flag: autosave and a manual Ctrl+S can otherwise race
 * and write the same board twice, bumping `sceneVersion` for no reason.
 *
 * Save status is posted to the parent frame with a tiny message protocol so the
 * dashboard iframe can show "Saving…"/"Saved". If the editor is not framed
 * (`window.parent === window`) the post is a no-op.
 */
export const startBoardAutosave = (
  boardId: string,
  api: ExcalidrawImperativeAPI,
): (() => void) => {
  let inFlight = false;
  let disposed = false;

  const isFramed = () => window.parent !== window;

  const post = (type: "saving" | "saved", boardId: string) => {
    if (!isFramed()) {
      return;
    }
    try {
      window.parent.postMessage({ type: `mosaic:${type}`, boardId }, "*");
    } catch {
      // A framed editor under a strict CSP can refuse postMessage; saving must
      // still work, so swallow it.
    }
  };

  // The scene version the dashboard had when it last told us what was stored.
  // The parent owns the version now (it is the one calling storage.saveBoardScene,
  // which bumps scene_version server-side), so we only mirror it for the ack.
  let lastAckedVersion: number | undefined;

  /**
   * Hand the scene to the parent and wait for it to confirm the write.
   *
   * Waiting on the ack is what keeps the in-flight guard honest: the save is not
   * finished until the dashboard has actually persisted it, so a slow round trip
   * cannot be overtaken by the next autosave tick.
   */
  const saveViaParent = (
    scene: string,
    thumbnail: string | null,
    reason: string,
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      const targetOrigin = window.location.origin;
      const timer = window.setTimeout(() => {
        window.removeEventListener("message", onAck);
        reject(new Error(`[mosaic] save ack timed out (${reason})`));
      }, SAVE_ACK_TIMEOUT_MS);

      const onAck = (event: MessageEvent) => {
        if (event.origin !== targetOrigin) {
          return;
        }
        if (event.data?.type !== "mosaic:saved") {
          return;
        }
        if (event.data?.boardId !== boardId) {
          return;
        }
        window.clearTimeout(timer);
        window.removeEventListener("message", onAck);
        lastAckedVersion = event.data.sceneVersion ?? lastAckedVersion;
        resolve();
      };

      window.addEventListener("message", onAck);
      try {
        window.parent.postMessage(
          {
            type: "mosaic:save-board",
            boardId,
            scene,
            thumbnail,
            baseVersion: lastAckedVersion,
          },
          targetOrigin,
        );
      } catch (error) {
        window.clearTimeout(timer);
        window.removeEventListener("message", onAck);
        reject(error);
      }
    });

  const runSave = async (reason: string) => {
    if (inFlight || disposed) {
      return;
    }
    inFlight = true;
    post("saving", boardId);
    try {
      const thumbnail = captureThumbnail();
      const scene = serializeScene(api);
      if (isFramed()) {
        // The dashboard owns storage. It knows whether this environment persists
        // to IndexedDB or to the API, so the editor must not write either itself.
        await saveViaParent(scene, thumbnail, reason);
      } else {
        // Standalone editor at the top level (no dashboard to route through):
        // keep writing directly so it still saves on its own.
        await writeBoardRecord(boardId, { scene, thumbnail });
      }
      post("saved", boardId);
    } catch (error) {
      // Never let an autosave failure break the editor: the user keeps drawing
      // and the next tick retries.
      console.warn(`[mosaic] autosave (${reason}) failed`, error);
    } finally {
      inFlight = false;
    }
  };

  // Adopt the version the dashboard reports when it hydrates us, so the first
  // save carries a valid optimistic-concurrency token.
  const onLoadBoard = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    if (event.data?.type !== "mosaic:load-board") {
      return;
    }
    if (event.data?.boardId !== boardId) {
      return;
    }
    lastAckedVersion = event.data.sceneVersion ?? 0;
  };
  window.addEventListener("message", onLoadBoard);

  const interval = window.setInterval(() => {
    void runSave("interval");
  }, AUTOSAVE_INTERVAL_MS);

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      void runSave("visibilitychange");
    }
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const isSave =
      (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s";
    if (isSave) {
      // The editor's own "save to disk" handler also binds Ctrl+S; stop it so
      // board mode saves to IndexedDB instead of popping a download dialog.
      event.preventDefault();
      event.stopPropagation();
      void runSave("ctrl-s");
    }
  };

  const onBeforeUnload = () => {
    // Best-effort: a synchronous IDB write is not possible here, but queuing the
    // save often completes before the page actually goes away.
    void runSave("unload");
  };

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("beforeunload", onBeforeUnload);

  return () => {
    disposed = true;
    window.clearInterval(interval);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("keydown", onKeyDown, true);
    window.removeEventListener("beforeunload", onBeforeUnload);
    window.removeEventListener("message", onLoadBoard);
  };
};

/**
 * URL for the "back to dashboard" control.
 *
 * In the Docker/nginx deployment the dashboard *is* the root (`/` serves
 * mosaic-dashboard and `/app/` serves this editor), so `/` is correct there.
 * The `VITE_DASHBOARD_URL` override exists for deployments that mount the
 * dashboard somewhere else.
 *
 * The default is `/dashboard`, not `/`, and that difference matters.
 *
 * `/` is the site root, and on Vercel it serves the dashboard's `index.html`,
 * which then redirects to `/dashboard` with a `<Navigate replace>`. A redirect
 * cannot be relied on to complete from inside an iframe: the editor frame
 * navigates to `/`, the dashboard's client-side router takes over, and the
 * nested navigation is what the old footer link was doing when Task 1 removed
 * the board page's header duplicate. Pointing straight at `/dashboard` removes
 * the hop, and `/dashboard` is a real route in both deployments, so this stays
 * correct for nginx as well.
 *
 * Verified: with `/`, the link resolved to `http://localhost:3101/` and a click
 * timed out waiting for `**\/dashboard**`. With `/dashboard` there is nothing to
 * redirect through.
 */
export const dashboardUrl = (): string =>
  (import.meta.env.VITE_DASHBOARD_URL as string | undefined) ?? "/dashboard";
