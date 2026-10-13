/**
 * Bridges the framed editor to the dashboard's storage adapter.
 *
 * The editor is deliberately ignorant of *where* boards live: it used to write
 * to IndexedDB itself, which works locally but silently does nothing on the API
 * deployment (there is no matching row to update, and no request is ever made).
 * Now it hands the scene to us and we persist it through `storage`, which
 * already picks the right backend per environment — IndexedDB in dev, the API in
 * production. The adapter stays the single source of truth for that choice.
 */
import { useCallback, useEffect, useRef } from "react";

import { storage } from "@/lib/storage";

/** Shape of a `mosaic:save-board` message from the editor. */
type SaveBoardMessage = {
  type: "mosaic:save-board";
  boardId: string;
  scene: string;
  thumbnail: string | null;
  /** Optimistic-concurrency token echoed from our last ack, if we have one. */
  baseVersion?: number;
};

/** Save status the editor is currently reporting, for the header pill. */
export type SaveState =
  | { status: "saving" }
  | { status: "saved"; at: number }
  | { status: "error"; at: number };

const isSaveMessage = (data: unknown): data is SaveBoardMessage => {
  if (typeof data !== "object" || data === null) {
    return false;
  }
  const m = data as Partial<SaveBoardMessage>;
  return (
    m.type === "mosaic:save-board" &&
    typeof m.boardId === "string" &&
    typeof m.scene === "string"
  );
};

export function useBoardBridge({
  boardId,
  iframeRef,
  editorOrigin,
  onSaveState,
}: {
  boardId: string;
  /**
   * `HTMLIFrameElement | null` because React 19's `useRef<HTMLIFrameElement>(null)`
   * returns a ref whose `current` starts as null. That is the state this hook
   * sees before the iframe mounts, and it is exactly why every send goes through
   * the optional chain rather than an assumed-present ref.
   */
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  /** Same-origin in our deployment, but kept explicit rather than assumed. */
  editorOrigin: string;
  onSaveState?: (state: SaveState) => void;
}) {
  // The last version we know storage holds. Doubles as the `baseVersion` token,
  // so a write that was superseded elsewhere is skipped instead of clobbering.
  const versionRef = useRef<number | undefined>(undefined);
  // Set while a hydrate is in flight, so a duplicate request does not double-read.
  const hydratingRef = useRef(false);
  // One write at a time: a second message while the first is in flight would
  // read a stale version and be skipped by the guard, losing the newer scene.
  const queueRef = useRef<Promise<void>>(Promise.resolve());

  const postToEditor = useCallback(
    (message: unknown) => {
      iframeRef.current?.contentWindow?.postMessage(message, editorOrigin);
    },
    [iframeRef, editorOrigin],
  );

  /** Fetch the stored scene and push it into the editor once it reports ready. */
  const hydrate = useCallback(async () => {
    // The editor can ask twice: once via `mosaic:load-board-request` (which
    // unblocks its first paint) and once via `excalidraw/ready`. Answering both
    // would mean two storage reads and a second scene restore, so only the first
    // request in flight is honoured.
    if (hydratingRef.current) {
      return;
    }
    hydratingRef.current = true;
    try {
      const board = await storage.getBoard(boardId);
      versionRef.current = board?.sceneVersion ?? 0;
      postToEditor({
        type: "mosaic:load-board",
        boardId,
        scene: board?.scene ?? null,
        sceneVersion: versionRef.current,
      });
    } finally {
      hydratingRef.current = false;
    }
  }, [boardId, postToEditor]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      // Reject anything not from our own editor frame. The editor is same-origin
      // today, but this check is what keeps that from becoming a write primitive
      // if it is ever mounted cross-origin.
      if (event.origin !== editorOrigin) {
        return;
      }
      if (event.source !== iframeRef.current?.contentWindow) {
        return;
      }

      if (event.data?.type === "excalidraw/ready") {
        void hydrate();
        return;
      }

      // The editor asks for its scene on mount. `excalidraw/ready` covers the
      // common case, but this is the request that actually unblocks the editor's
      // first paint, so it must be answered even if the ready signal was lost.
      if (
        event.data?.type === "mosaic:load-board-request" &&
        event.data?.boardId === boardId
      ) {
        void hydrate();
        return;
      }

      if (!isSaveMessage(event.data) || event.data.boardId !== boardId) {
        return;
      }

      const { scene, thumbnail } = event.data;
      onSaveState?.({ status: "saving" });

      // Chain onto the queue so saves land in the order the editor sent them,
      // each reading the version the previous write produced.
      queueRef.current = queueRef.current
        .then(async () => {
          const saved = await storage.saveBoardScene(boardId, {
            scene,
            thumbnail,
            baseVersion: versionRef.current,
          });

          if (saved === undefined && versionRef.current !== undefined) {
            // The guard rejected this write: someone else advanced the scene.
            // Re-read so we do not keep retrying against a version we lost.
            const fresh = await storage.getBoard(boardId);
            versionRef.current = fresh?.sceneVersion ?? 0;
            throw new Error("board scene was modified elsewhere");
          }

          if (saved) {
            versionRef.current = saved.sceneVersion ?? versionRef.current;
          }

          postToEditor({
            type: "mosaic:saved",
            boardId,
            sceneVersion: versionRef.current,
          });
          onSaveState?.({ status: "saved", at: Date.now() });
        })
        .catch((error: unknown) => {
          console.warn("[mosaic] board bridge save failed", error);
          onSaveState?.({ status: "error", at: Date.now() });
          // Tell the editor so it stops waiting on an ack that is not coming.
          postToEditor({
            type: "mosaic:saved",
            boardId,
            sceneVersion: undefined,
          });
        });
    };

    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [boardId, editorOrigin, hydrate, iframeRef, onSaveState, postToEditor]);

  // The editor may already be ready by the time this effect runs (it can post
  // during its first paint), and an iframe that never announces itself would
  // otherwise never be hydrated.
  useEffect(() => {
    const frame = iframeRef.current;
    if (!frame || (frame.dataset as DOMStringMap).hydrated) {
      return;
    }
    (frame.dataset as DOMStringMap).hydrated = "1";
    const onLoad = () => void hydrate();
    frame.addEventListener("load", onLoad);
    return () => frame.removeEventListener("load", onLoad);
  }, [hydrate, iframeRef]);

  return { hydrate };
}
