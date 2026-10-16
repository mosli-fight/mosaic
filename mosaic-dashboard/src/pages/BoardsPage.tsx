import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import {
  BoardGridSkeleton,
  LOADING_BOARDS_LABEL,
  LOADING_COUNT_LABEL,
} from "@/components/board/BoardGridSkeleton";
import { BoardGrid } from "@/components/board/BoardGrid";
import { BoardToolbar } from "@/components/board/BoardToolbar";
import { Modal } from "@/components/common/Modal";
import { t } from "@/lib/i18n";
import { pluralize, selectBoards } from "@/lib/selectors";
import { useDashboardStore } from "@/state/useDashboardStore";

import styles from "./BoardsPage.module.scss";

/**
 * The board list route (STEP 2).
 *
 * One component serves `/dashboard`, `/dashboard/favorites`,
 * `/dashboard/folders/:folderId` and `/dashboard/trash`. They differ only in
 * which filters are applied, and `selectBoards` already encodes every one of
 * those cases (including the three-way meaning of `folderId`:
 * undefined = no filter, null = unfiled only, string = that folder).
 * Splitting into four near-identical pages would just duplicate that mapping.
 */
export const BoardsPage = () => {
  const location = useLocation();
  const params = useParams();
  const navigate = useNavigate();

  const boards = useDashboardStore((s) => s.boards);
  const folders = useDashboardStore((s) => s.folders);
  const loadState = useDashboardStore((s) => s.loadState);
  const hasLoaded = useDashboardStore((s) => s.hasLoaded);
  const query = useDashboardStore((s) => s.query);
  const sort = useDashboardStore((s) => s.sort);

  const isTrash = location.pathname.endsWith("/trash");
  const isFavorites = location.pathname.endsWith("/favorites");
  const folderId = params.folderId ?? undefined;

  // Derive the view model once per render rather than in each child.
  const visible = useMemo(
    () =>
      selectBoards(boards, {
        query,
        sort,
        favoritesOnly: isFavorites,
        includeTrashed: isTrash,
        ...(folderId !== undefined ? { folderId } : {}),
      }),
    [boards, query, sort, isFavorites, isTrash, folderId],
  );

  const heading = isTrash
    ? t("trash.title")
    : isFavorites
    ? t("nav.favorites")
    : folderId
    ? folders.find((f) => f.id === folderId)?.name ?? t("nav.folders")
    : t("nav.allBoards");

  /**
   * True only before the first read has resolved.
   *
   * `idle` and `loading` both mean "we do not know yet", and both used to fall
   * through to the empty state, which asserted "No boards yet / 0 boards" to anyone
   * who already had boards. `hasLoaded` is what separates that from the genuine
   * empty case, which only `hasLoaded` can answer.
   *
   * A refresh that runs over data already on screen does not re-enter this state:
   * it keeps showing the previous rows rather than flashing a skeleton on every
   * navigation.
   */
  const initialising = !hasLoaded && loadState !== "error";

  /**
   * Empty-state copy. Resolved as a pair of explicit keys rather than by string
   * concatenation, because `board.empty.title` and `board.empty.folder` etc. are
   * separate dictionary entries and a dynamic key would be impossible to check.
   */
  const emptyCopy = (() => {
    if (isTrash) {
      return { title: t("trash.title"), description: t("board.empty.trash") };
    }
    if (isFavorites) {
      return {
        title: t("nav.favorites"),
        description: t("board.empty.favorites"),
      };
    }
    if (query.trim()) {
      return {
        title: t("nav.allBoards"),
        description: t("board.empty.filtered"),
      };
    }
    if (folderId) {
      return {
        title: t("nav.folders"),
        description: t("board.empty.folder"),
      };
    }
    return {
      title: t("board.empty.title"),
      description: t("board.empty.description"),
    };
  })();

  const hasToolbar = !isTrash;

  return (
    <div className={styles.page}>
      <header className={styles.header} data-testid="page-header">
        <div>
          <h1
            className={`${styles.header__title} ${
              hasToolbar ? styles["header__title--withToolbar"] : ""
            }`}
            data-testid="page-heading"
          >
            {heading}
          </h1>
          <p className={styles.header__count} data-testid="board-count">
            {initialising
              ? LOADING_COUNT_LABEL
              : pluralize(visible.length, "board")}
          </p>
        </div>
      </header>

      {isTrash ? (
        <TrashHeader
          onEmpty={async () => {
            await useDashboardStore.getState().emptyTrash();
          }}
        />
      ) : (
        <BoardToolbar
          onCreate={async () => {
            const board = await useDashboardStore.getState().createBoard();
            navigate(`/board/${board.id}`);
          }}
        />
      )}

      {initialising ? (
        <>
          <span
            role="status"
            data-testid="boards-loading-status"
            className="dashboard-sr-only"
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clipPath: "inset(50%)",
              whiteSpace: "nowrap",
            }}
          >
            {LOADING_BOARDS_LABEL}
          </span>
          <BoardGridSkeleton />
        </>
      ) : visible.length === 0 ? (
        <div className={styles.empty} data-testid="empty-state">
          <p className={styles.empty__title}>{emptyCopy.title}</p>
          <p className={styles.empty__description}>{emptyCopy.description}</p>
          {!isTrash && !isFavorites && !query.trim() ? (
            <button
              type="button"
              className={styles.empty__create}
              data-testid="empty-state-create"
              onClick={async () => {
                const board = await useDashboardStore.getState().createBoard();
                navigate(`/board/${board.id}`);
              }}
            >
              <span
                style={{ fontSize: 18, lineHeight: 1 }}
                aria-hidden="true"
              >
                +
              </span>
              {t("board.empty.action")}
            </button>
          ) : null}
        </div>
      ) : (
        <BoardGrid boards={visible} isTrashView={isTrash} />
      )}
    </div>
  );
};

/**
 * Trash-specific header (STEP 7): explains the retention policy and offers an
 * "empty trash" action behind a confirm dialog, since it is irreversible.
 */
const TrashHeader = ({ onEmpty }: { onEmpty: () => Promise<void> }) => {
  const [confirming, setConfirming] = useState(false);
  const boards = useDashboardStore((s) => s.boards);
  const trashedCount = boards.filter((b) => b.trashedAt !== null).length;

  return (
    <div
      className={styles.trashHeader}
      data-testid="trash-header"
    >
      <p className={styles.trashNote}>{t("trash.empty")}</p>
      {trashedCount > 0 ? (
        <button
          type="button"
          className={styles.trashButton}
          onClick={() => setConfirming(true)}
          data-testid="empty-trash"
        >
          {t("nav.trash")} — {t("common.delete")} all
        </button>
      ) : null}

      <Modal
        open={confirming}
        title={t("common.delete")}
        description={t("settings.resetConfirm")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void onEmpty();
          setConfirming(false);
        }}
      />
    </div>
  );
};
