import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { BRAND } from "@mosaic/brand";

import styles from "./BoardPage.module.scss";

import type { Board } from "@/db/schema";

import { storage } from "@/lib/storage";

import { t } from "@/lib/i18n";
import { useDashboardStore } from "@/state/useDashboardStore";
import { useBoardBridge, type SaveState } from "@/hooks/useBoardBridge";

/**
 * Board editor route (STEP 2 `/board/:id`, STEP 6 editor integration).
 *
 * Architecture note — why an iframe instead of embedding Excalidraw directly:
 * the editor is a *separate Vite app* with its own PWA service worker, its own
 * `EXCALIDRAW_ASSET_PATH` and its own fonts. Loading it as an iframe keeps the
 * two apps fully isolated (this is also what preserves Part 1's guarantee that
 * the editor build is untouched) and mirrors how the editor's own embeddable
 * mode works. We talk to it over `postMessage` using a small, versioned
 * protocol defined in `lib/editorBridge.ts`.
 *
 * When the editor is served from the same host it reads the board id from the
 * `#board=<id>` hash (STEP 6), loads the scene from IndexedDB itself, and
 * autosaves. This page's job is to render that iframe, show a back link, and
 * mirror save status back into the dashboard store.
 *
 * ## Why this route is outside the app shell
 *
 * It used to render inside `<AppShell>`, which wraps it in a persistent sidebar
 * plus a padded, scrollable content column. That is right for the board list and
 * wrong for the editor: the sidebar took 248px, the shell's padding took the rest
 * of the gutter, and the iframe was left small. Worse, a flex chain that
 * resolves to zero makes Excalidraw size its canvas to zero and never recover.
 *
 * So `/board/:id` sits beside the shell route rather than inside it, and this
 * page owns a fixed full-viewport layout of its own. `AppShell` is untouched,
 * because every other page still wants it.
 */
export const BoardPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const reload = useDashboardStore((s) => s.reload);

  const [board, setBoard] = useState<Board | null>(null);
  const [missing, setMissing] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle",
  );
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Persist the editor's scene through our storage adapter, and hydrate the
  // editor with the stored scene when it reports ready.
  const handleSaveState = useCallback(
    (state: SaveState) => {
      if (state.status === "saving") {
        setSaveState("saving");
        return;
      }
      setSaveState(state.status === "saved" ? "saved" : "idle");
      if (state.status === "saved") {
        setSavedAt(state.at);
        void reload();
        // Drop back to idle so the pill does not claim "Saved" forever.
        window.setTimeout(() => setSaveState("idle"), 1600);
      }
    },
    [reload],
  );

  useBoardBridge({
    boardId: id ?? "",
    iframeRef,
    editorOrigin: window.location.origin,
    onSaveState: handleSaveState,
  });

  // Load the board and record the open in the activity log.
  useEffect(() => {
    if (!id) {
      return;
    }
    let cancelled = false;
    void (async () => {
      const found = await storage.getBoardWithScene(id);
      if (cancelled) {
        return;
      }
      if (!found) {
        setMissing(true);
        return;
      }
      setBoard(found);
      await storage.markBoardOpened(id);
      await reload();
    })();
    return () => {
      cancelled = true;
    };
  }, [id, reload]);

  /**
   * The editor's own `mosaic:saving` / `mosaic:saved` status messages are
   * handled inside `useBoardBridge`, which reports them through `onSaveState`.
   * It has to, because it also owns the parent→editor `mosaic:saved` ack: the
   * two messages share a type name but travel in opposite directions, and a
   * single listener here would mark the board saved the moment the editor asked,
   * before anything was persisted.
   */

  // Keeps "Saved 2s ago" honest without re-rendering the editor.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (saveState !== "saved") {
      return;
    }
    const timer = window.setInterval(() => forceTick((n) => n + 1), 10_000);
    return () => window.clearInterval(timer);
  }, [saveState]);

  if (missing) {
    return (
      <div className={styles.missing} data-testid="board-missing">
        <h1 className={styles.missing__title}>Board not found</h1>
        <button type="button" onClick={() => navigate("/dashboard")}>
          {t("editor.back")}
        </button>
      </div>
    );
  }

  if (!id) {
    return null;
  }

  const editorUrl = buildEditorUrl(id);

  return (
    <div className={styles.page} data-testid="board-page">
      {/**
       * Slim bar, not a page header. It carries the board name and the save
       * state, and it is fixed-height so the editor gets every remaining pixel.
       *
       * The back link that used to sit here is gone: the editor renders its own
       * "← Back to dashboard" in its footer, so the page had two of them on
       * screen at once, one top-left and one bottom-right. Removing only this
       * one leaves the footer control as the single way back.
       *
       * Do not add a replacement here, and do not add one to the MainMenu — the
       * footer already covers it.
       */}
      <div className={styles.bar}>
        <div className={styles.bar__left}>
          <span className={styles.name}>{board?.name ?? "…"}</span>
        </div>
        {saveState === "saving" ? (
          <span
            className={`${styles.status} ${styles.status__saving}`}
            data-testid="save-status"
          >
            {t("editor.unsaved")}
          </span>
        ) : saveState === "saved" ? (
          <span
            className={`${styles.status} ${styles.status__saved}`}
            data-testid="save-status"
          >
            {t("editor.saved")}
            {savedAt ? ` ${relativeTime(savedAt)}` : ""}
          </span>
        ) : null}
      </div>

      <iframe
        ref={iframeRef}
        className={styles.frame}
        src={editorUrl}
        title={`${BRAND.name} editor`}
        data-testid="editor-frame"
        // Excalidraw writes into IndexedDB and reads it back. A third-party
        // cookie blocking the dashboard's session does not affect a same-origin
        // frame, but being explicit costs nothing and documents the intent.
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
};

/**
 * Renders a coarse "N ago" label for the save pill.
 *
 * Deliberately coarse: this is a reassurance that the work was not lost, not a
 * timestamp worth reading precisely, and coarse units avoid re-rendering every
 * few seconds for no visible benefit.
 */
function relativeTime(timestamp: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 60) {
    return "just now";
  }
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes}m ago` : `${Math.round(minutes / 60)}h ago`;
}

/**
 * Builds the editor URL.
 *
 * Dev: the editor dev server runs on VITE_EDITOR_URL (default http://localhost:3000)
 * and we pass the pre-loaded scene via the hash so the editor has something to
 * render before its first autosave. Prod: the editor is served from `/`, so a
 * relative `/#board=<id>` works under the same nginx.
 */
/**
 * Builds the editor URL.
 *
 * Always a same-origin relative path. That is load-bearing, not cosmetic:
 * IndexedDB is partitioned per origin and board mode reads scenes straight out
 * of the dashboard's database, so if the editor ended up on another origin it
 * would open an empty board every single time.
 *
 * The mount point comes from VITE_EDITOR_BASE:
 *  - production (Docker/nginx): the editor is served at `/app/`
 *  - dev / e2e: the static preview server mounts it at `/editor/`
 *
 * Reading it from one place rather than hard-coding it is what stops the two
 * deployments from drifting: a wrong path here is a blank iframe with no error.
 *
 * The scene is NOT passed in the URL. The editor hydrates from IndexedDB
 * itself; embedding a possibly multi-megabyte scene in the fragment bloats the
 * URL, leaks board content into browser history, and complicates hydration
 * precedence (which of URL vs DB wins?). One source.
 */
const EDITOR_BASE = (
  (import.meta.env.VITE_EDITOR_BASE as string | undefined) ?? "/app/"
).replace(/\/$/, "");

const buildEditorUrl = (boardId: string) => {
  const params = new URLSearchParams();
  params.set("board", boardId);
  return `${EDITOR_BASE}/#${params.toString()}`;
};
