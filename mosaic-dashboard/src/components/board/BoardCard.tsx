import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { BoardContextMenu } from "./BoardContextMenu";
import { ShareModal } from "./ShareModal";

import styles from "./BoardCard.module.scss";

import type { DownloadFormat } from "./BoardContextMenu";

import type { Board } from "@/db/schema";

import type { BoardStats } from "@/lib/storage/types";

import { MosaicMark } from "@/components/common/MosaicMark";
import { Modal } from "@/components/common/Modal";
import { downloadBoard } from "@/lib/download";
import { t } from "@/lib/i18n";
import {
  boardActivityLabel,
  boardActivityTimestamp,
  exactTimestamp,
  pluralize,
} from "@/lib/selectors";

import { useDashboardStore } from "@/state/useDashboardStore";

/**
 * A single board tile (STEP 3).
 *
 * Interaction summary:
 *  - click (no modifier)  → open in the editor
 *  - double-click on name → inline rename
 *  - ctrl/cmd click       → toggle selection
 *  - shift click          → range selection (handled by BoardGrid)
 *  - star button          → favourite toggle, stops propagation so it does not
 *                           also open the board
 *  - "..." button         → context menu (open/rename/duplicate/move/download/
 *                           share/trash/delete forever)
 *
 * "Delete forever" is the exception to "menu items act immediately": it opens a
 * confirm dialog, because it is the only action here that leaves no recovery path —
 * not the trash, not the 30-day purge.
 *
 * All the data mutation goes through the store, which wraps the DB call and
 * refreshes. The card itself never touches Dexie.
 */
export const BoardCard = ({
  board,
  selected,
  stats,
  isTrashView,
  onToggleSelect,
  onRangeSelect,
}: {
  board: Board;
  selected: boolean;
  stats?: BoardStats;
  isTrashView: boolean;
  onToggleSelect: () => void;
  onRangeSelect: () => void;
}) => {
  const navigate = useNavigate();
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(board.name);
  const [menuOpen, setMenuOpen] = useState(false);
  // The menu anchors to the "..." button; captured so the popover can position
  // itself under the exact element that was clicked.
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  // STEP 5: which board, if any, has the share dialog open. Local to the card so
  // two cards on screen cannot both hold a dialog.
  const [sharing, setSharing] = useState(false);
  // "Delete forever" is the one menu item that cannot be undone and cannot be
  // recovered from the trash afterwards, so it opens a confirm dialog rather than
  // firing on click — the same shape as the editor's Clear canvas dialog.
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const renameBoard = useDashboardStore((s) => s.renameBoard);
  const toggleFavorite = useDashboardStore((s) => s.toggleFavorite);
  const duplicateBoard = useDashboardStore((s) => s.duplicateBoard);
  const moveBoardToFolder = useDashboardStore((s) => s.moveBoardToFolder);
  const trashBoard = useDashboardStore((s) => s.trashBoard);
  const restoreBoard = useDashboardStore((s) => s.restoreBoard);
  const deleteBoardForever = useDashboardStore((s) => s.deleteBoardForever);
  const folders = useDashboardStore((s) => s.folders);

  const open = () => {
    if (isTrashView) {
      return;
    }
    navigate(`/board/${board.id}`);
  };

  /**
   * Card click handler.
   *
   * React portals propagate synthetic events along the *React* tree, not the DOM
   * tree. The context menu is portaled to `document.body` but is still a React
   * child of this card, so a click on a menu item bubbles here too and would
   * open the board. The `menuOpen` check short-circuits that: while the menu is
   * open, clicks coming from it must not be treated as a card activation.
   *
   * `confirmingDelete` is guarded for the same reason: the confirm dialog is
   * another portal under this card, and the dialog's Cancel and Delete buttons
   * live inside a node that stops propagation, but a stray click on the backdrop
   * must never also open the board.
   *
   * Ctrl/Cmd click opens a new tab.
   *
   * This cannot be done with an `<a href>` wrapper, because the card contains
   * buttons and an input for select, rename and the overflow menu, and nesting
   * interactive elements inside an anchor is invalid HTML: assistive technology
   * treats the whole card as one link and the inner controls stop being
   * reachable. So the tab behaviour is done explicitly and everything else keeps
   * its native semantics.
   *
   * Middle-click is not handled. React does not deliver it as a click, and
   * `window.open` cannot be driven from `auxclick` reliably across browsers. That
   * is the one case an anchor would have given for free.
   */
  const handleClick = (event: React.MouseEvent) => {
    if (renaming || menuOpen || confirmingDelete) {
      return;
    }
    if (event.shiftKey) {
      onRangeSelect();
      return;
    }
    if (isTrashView) {
      return;
    }
    if (event.metaKey || event.ctrlKey) {
      // Browser-standard new tab, and `noopener` so the opened page cannot reach
      // back through `window.opener`.
      window.open(`/board/${board.id}`, "_blank", "noopener,noreferrer");
      return;
    }
    open();
  };

  const commitRename = async () => {
    const name = draftName.trim();
    setRenaming(false);
    if (name && name !== board.name) {
      await renameBoard(board.id, name);
    }
  };

  /**
   * When this board was last touched, as a label and as an exact timestamp.
   *
   * Derived here rather than inline because the same two values are needed in
   * different shapes: the label goes in the text, the timestamp in the `title`.
   * `boardActivityTimestamp` returning null is a real case - an API row whose
   * `timestamptz` could not be parsed - and it renders a dash rather than a
   * confident lie. See `selectors.ts`.
   */
  const activityTimestamp = boardActivityTimestamp(board);
  const label = boardActivityLabel(board);
  const exact = exactTimestamp(activityTimestamp);

  return (
    <div
      className={[
        styles.card,
        selected ? styles.isSelected : "",
        isTrashView ? "" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={handleClick}
      data-testid={`board-card-${board.id}`}
      data-selected={selected || undefined}
      role="listitem"
      aria-label={board.name}
    >
      <div className={styles.thumb}>
        {board.thumbnail ? (
          <img
            className={styles.thumb__img}
            src={board.thumbnail}
            alt=""
            data-testid={`board-thumb-${board.id}`}
          />
        ) : (
          <span className={styles.thumb__placeholder}>
            <MosaicMark size={28} />
          </span>
        )}

        {isTrashView ? null : (
          <button
            type="button"
            className={`${styles.selectBox} ${
              selected ? styles.isChecked : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleSelect();
            }}
            aria-pressed={selected}
            aria-label={selected ? "Deselect board" : "Select board"}
            data-testid={`select-${board.id}`}
          >
            ✓
          </button>
        )}

        {isTrashView ? null : (
          <button
            type="button"
            className={`${styles.star} ${
              board.favorite ? styles.isFavorite : ""
            }`}
            onClick={(e) => {
              e.stopPropagation();
              void toggleFavorite(board.id);
            }}
            title={
              board.favorite
                ? t("board.action.unfavorite")
                : t("board.action.favorite")
            }
            aria-pressed={board.favorite}
            aria-label={
              board.favorite
                ? t("board.action.unfavorite")
                : t("board.action.favorite")
            }
            data-testid={`star-${board.id}`}
          >
            {board.favorite ? "★" : "☆"}
          </button>
        )}

        <button
          type="button"
          className={styles.menuButton}
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor(e.currentTarget);
            setMenuOpen(true);
          }}
          aria-label={t("common.more")}
          data-testid={`menu-${board.id}`}
        >
          ⋯
        </button>
      </div>

      <div className={styles.body}>
        {renaming ? (
          <input
            className={styles.nameInput}
            value={draftName}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void commitRename();
              } else if (e.key === "Escape") {
                setDraftName(board.name);
                setRenaming(false);
              }
            }}
            data-testid={`rename-input-${board.id}`}
          />
        ) : (
          <span
            className={styles.name}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setDraftName(board.name);
              setRenaming(true);
            }}
            data-testid={`board-name-${board.id}`}
          >
            {board.name}
          </span>
        )}

        <div className={styles.meta}>
          {/**
           * The time, and the exact time behind it.
           *
           * `title` carries the absolute timestamp because the relative label is a
           * summary and this is a board card — nobody needs to read "2 hours ago"
           * to know when a meeting is, but "2 hours ago" next to "2 edits · 7d" used
           * to be the only thing on the row saying *when* this was touched.
           */}
          <span title={exact} data-testid={`age-${board.id}`}>
            {label}
          </span>
          {/**
           * The activity chip, and only when there is activity in the window it
           * describes.
           *
           * Two fixes over the previous `stats.total > 0`: a board last touched
           * three months ago used to render "0 edits · 7d" because its *total* was
           * non-zero, and the string was indistinguishable from the time beside it.
           * It is now pluralised through `pluralize` (so "1 edit", not "1 edits") and
           * says which window it is counting.
           */}
          {stats && stats.last7Days > 0 ? (
            <span
              className={styles.statsChip}
              data-testid={`stats-${board.id}`}
              title={t("board.card.editsWeekTitle", {
                edits: pluralize(stats.total, "edit"),
              })}
            >
              {t("board.card.editsWeek", {
                edits: pluralize(stats.last7Days, "edit"),
              })}
            </span>
          ) : null}
        </div>
      </div>

      <BoardContextMenu
        open={menuOpen}
        anchorEl={menuAnchor}
        onClose={() => {
          setMenuOpen(false);
          setMenuAnchor(null);
        }}
        board={board}
        folders={folders}
        isTrashView={isTrashView}
        actions={{
          onOpen: () => navigate(`/board/${board.id}`),
          onRename: () => {
            setDraftName(board.name);
            setRenaming(true);
          },
          onDuplicate: () => void duplicateBoard(board.id),
          onMove: (folderId: string | null) =>
            void moveBoardToFolder(board.id, folderId),
          onDownload: (format: DownloadFormat) =>
            void downloadBoard(board, format),
          // Opens the dialog; the board id is threaded through so the dialog does
          // not need to be handed the whole row.
          onShare: () => setSharing(true),
          onTrash: () => void trashBoard(board.id),
          onRestore: () => void restoreBoard(board.id),
          onDeleteForever: () => setConfirmingDelete(true),
        }}
      />

      <Modal
        open={confirmingDelete}
        title={t("board.delete.title")}
        description={t("board.delete.body", { name: board.name })}
        confirmLabel={t("board.action.deleteForever")}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          // Closed first so the dialog cannot be left open over a card that no
          // longer exists, and so a second click cannot queue a second delete.
          setConfirmingDelete(false);
          void deleteBoardForever(board.id);
        }}
      />

      <ShareModal
        boardId={board.id}
        boardName={board.name}
        open={sharing}
        onClose={() => setSharing(false)}
      />
    </div>
  );
};
