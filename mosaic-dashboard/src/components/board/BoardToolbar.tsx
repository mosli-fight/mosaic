import { useState } from "react";

import { useDashboardStore } from "@/state/useDashboardStore";
import { t } from "@/lib/i18n";
import { BOARD_SORTS, type BoardSort } from "@/db/schema";
import { pluralize } from "@/lib/selectors";

import pageStyles from "@/pages/BoardsPage.module.scss";

/**
 * Search, sort and bulk-action bar above the grid (STEP 3).
 *
 * Query and sort live in the store rather than in local state so the trash page
 * and the folder pages share them, and so a filter survives navigation.
 *
 * The bulk bar only appears when something is selected; otherwise it would push
 * the grid down on every render.
 */
export const BoardToolbar = ({ onCreate }: { onCreate: () => void }) => {
  const query = useDashboardStore((s) => s.query);
  const setQuery = useDashboardStore((s) => s.setQuery);
  const sort = useDashboardStore((s) => s.sort);
  const setSort = useDashboardStore((s) => s.setSort);
  const selectedIds = useDashboardStore((s) => s.selectedIds);
  const clearSelection = useDashboardStore((s) => s.clearSelection);
  const trashBoard = useDashboardStore((s) => s.trashBoard);
  const toggleFavorite = useDashboardStore((s) => s.toggleFavorite);
  const moveBoardToFolder = useDashboardStore((s) => s.moveBoardToFolder);

  const [moveOpen, setMoveOpen] = useState(false);
  const folders = useDashboardStore((s) => s.folders);

  const hasSelection = selectedIds.length > 0;

  return (
    <div className={pageStyles.toolbar} data-testid="board-toolbar">
      <input
        type="search"
        placeholder={t("toolbar.search")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={pageStyles.search}
        data-testid="search-input"
      />

      <label className={pageStyles.sortField}>
        <span>{t("toolbar.sort")}</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as BoardSort)}
          className={pageStyles.sortSelect}
          data-testid="sort-select"
        >
          {BOARD_SORTS.map((option) => (
            <option key={option} value={option}>
              {t(`toolbar.sort.${option}`)}
            </option>
          ))}
        </select>
      </label>

      {hasSelection ? (
        <div className={pageStyles.bulkBar} data-testid="bulk-bar">
          <span className={pageStyles.bulkCount} data-testid="bulk-count">
            {pluralize(selectedIds.length, "selected", "selected")}
          </span>
          <button
            type="button"
            className={pageStyles.bulkButton}
            onClick={() => {
              void Promise.all(selectedIds.map((id) => toggleFavorite(id)));
            }}
            data-testid="bulk-favorite"
          >
            {t("board.bulk.favorite")}
          </button>
          <button
            type="button"
            className={pageStyles.bulkButton}
            onClick={() => setMoveOpen((v) => !v)}
            data-testid="bulk-move-toggle"
          >
            {t("board.bulk.move")}
          </button>
          {moveOpen ? (
            <div className={pageStyles.bulkBar} data-testid="bulk-move-list">
              <button
                type="button"
                className={pageStyles.bulkButton}
                onClick={() => {
                  void Promise.all(
                    selectedIds.map((id) => moveBoardToFolder(id, null)),
                  );
                  setMoveOpen(false);
                }}
                data-testid="bulk-move-unfiled"
              >
                {t("board.action.unfiled")}
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  type="button"
                  className={pageStyles.bulkButton}
                  onClick={() => {
                    void Promise.all(
                      selectedIds.map((id) => moveBoardToFolder(id, folder.id)),
                    );
                    setMoveOpen(false);
                  }}
                  data-testid={`bulk-move-${folder.id}`}
                >
                  {folder.name}
                </button>
              ))}
            </div>
          ) : null}
          <button
            type="button"
            className={`${pageStyles.bulkButton} ${pageStyles["bulkButton--danger"]}`}
            onClick={() => {
              void Promise.all(selectedIds.map((id) => trashBoard(id)));
              clearSelection();
            }}
            data-testid="bulk-trash"
          >
            {t("board.bulk.trash")}
          </button>
          <button
            type="button"
            className={pageStyles.bulkButton}
            onClick={clearSelection}
            data-testid="bulk-clear"
          >
            {t("board.bulk.clear")}
          </button>
        </div>
      ) : null}
    </div>
  );
};
