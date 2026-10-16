import { useEffect, useState } from "react";

import styles from "./ShareModal.module.scss";

import { Modal } from "@/components/common/Modal";
import { authEnabled } from "@/lib/auth";
import { t } from "@/lib/i18n";
import { apiBaseUrl } from "@/lib/storage";

/**
 * Share-a-board dialog (STEP 5).
 *
 * Shows the link, offers a copy button, and can revoke. Revoking is a
 * first-class action rather than something buried in a menu, because it is the one
 * thing a user needs when they shared something they should not have.
 *
 * The token is fetched on open rather than cached in app state, so there is exactly
 * one source of truth for "is this board shared" and no optimistic UI that could
 * disagree with the database.
 */

type ShareState =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "shared"; token: string }
  | { kind: "revoked" };

export const ShareModal = ({
  boardId,
  boardName,
  open,
  onClose,
}: {
  boardId: string;
  boardName: string;
  open: boolean;
  onClose: () => void;
}) => {
  const [state, setState] = useState<ShareState>({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  /**
   * A relative-to-origin URL, built on the client. Going through the API rather than
   * a configured public origin keeps this correct across preview deployments, where a
   * hard-coded host would point at the wrong place.
   */
  const shareUrl = (token: string) => `${location.origin}/share/${token}`;

  useEffect(() => {
    if (!open) {
      return;
    }
    setState({ kind: "loading" });
    setCopied(false);

    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${apiBaseUrl}/api/boards/${boardId}/share`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ mode: "view" }),
        });
        if (cancelled) {
          return;
        }
        if (!res.ok) {
          setState({ kind: "error" });
          return;
        }
        const body = (await res.json()) as { share?: { token?: string } };
        setState(
          body.share?.token
            ? { kind: "shared", token: body.share.token }
            : { kind: "error" },
        );
      } catch {
        if (!cancelled) {
          setState({ kind: "error" });
        }
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [open, boardId]);

  const handleCopy = async () => {
    if (state.kind !== "shared") {
      return;
    }
    try {
      await navigator.clipboard.writeText(shareUrl(state.token));
      setCopied(true);
    } catch {
      // Clipboard access is refused in some contexts (insecure origin, no
      // permission). The link is on screen and selectable, so failing quietly beats
      // an error the user cannot act on.
      setCopied(false);
    }
  };

  const handleRevoke = async () => {
    setBusy(true);
    try {
      const res = await fetch(`${apiBaseUrl}/api/boards/${boardId}/share`, {
        method: "DELETE",
        credentials: "include",
      });
      setState(res.ok ? { kind: "revoked" } : { kind: "error" });
    } catch {
      setState({ kind: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <Modal
      open
      title={t("board.share.title")}
      description={`${boardName} — ${t("board.share.intro")}`}
      confirmLabel={copied ? t("board.share.copied") : t("board.share.copy")}
      onConfirm={() => void handleCopy()}
      onCancel={onClose}
    >
      <div data-testid="share-modal" className={styles.share}>
        {!authEnabled ? (
          <p data-testid="share-unavailable">
            This build has no server, so sharing is unavailable. Boards are
            stored in this browser.
          </p>
        ) : state.kind === "loading" ? (
          <p data-testid="share-loading">Preparing link…</p>
        ) : state.kind === "error" ? (
          <p role="alert" data-testid="share-error">
            {t("board.share.failed")}
          </p>
        ) : state.kind === "revoked" ? (
          <p data-testid="share-revoked">{t("board.share.revoked")}</p>
        ) : (
          <>
            <label className={styles.label} htmlFor="share-url">
              Link
            </label>
            <input
              id="share-url"
              className={styles.input}
              readOnly
              value={shareUrl(state.token)}
              data-testid="share-url"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button
              type="button"
              className={styles.danger}
              onClick={() => void handleRevoke()}
              disabled={busy}
              data-testid="share-revoke"
            >
              {t("board.share.revoke")}
            </button>
          </>
        )}
      </div>
    </Modal>
  );
};
