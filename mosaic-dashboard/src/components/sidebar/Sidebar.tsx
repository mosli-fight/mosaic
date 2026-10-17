import { BRAND } from "@mosaic/brand";
import { useState, type FormEvent } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import styles from "./Sidebar.module.scss";

import { MosaicMark } from "@/components/common/MosaicMark";
import { useFolderDroppable } from "@/components/board/BoardGrid";
import { t } from "@/lib/i18n";
import { childFolders, countBoardsInFolder } from "@/lib/selectors";
import { useDashboardStore } from "@/state/useDashboardStore";
import { AccountBlock } from "@/components/sidebar/AccountBlock";
import { useAuthStore } from "@/state/useAuthStore";

/**
 * Persistent navigation (STEP 4).
 *
 * Layout is: brand, primary nav, "New board" CTA, then the folder tree with an
 * inline create row.
 *
 * Folder drag-and-drop target lives here too — `useDroppable` is applied to each
 * folder row so a board card can be dragged onto a folder to file it (STEP 4).
 * The drop logic itself is in `components/board/BoardGrid`, which owns the
 * DndContext.
 */
export const Sidebar = () => {
  const boards = useDashboardStore((s) => s.boards);
  const folders = useDashboardStore((s) => s.folders);
  const createBoard = useDashboardStore((s) => s.createBoard);
  const createFolder = useDashboardStore((s) => s.createFolder);
  const authUser = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const authSignOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const [creatingFolder, setCreatingFolder] = useState(false);
  const [folderName, setFolderName] = useState("");

  const live = boards.filter((b) => b.trashedAt === null);
  const roots = childFolders(folders, null);

  const handleNewBoard = async () => {
    const board = await createBoard();
    navigate(`/board/${board.id}`);
  };

  const handleCreateFolder = async (event: FormEvent) => {
    event.preventDefault();
    const name = folderName.trim();
    if (!name) {
      setCreatingFolder(false);
      setFolderName("");
      return;
    }
    await createFolder(name);
    setFolderName("");
    setCreatingFolder(false);
  };

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <MosaicMark className={styles.brand__mark} title={BRAND.name} />
        {BRAND.name}
      </div>

      <button
        type="button"
        className={styles.newBoard}
        onClick={handleNewBoard}
        data-testid="new-board"
      >
        + {t("nav.newBoard")}
      </button>

      <nav className={styles.nav}>
        <NavLink
          to="/dashboard"
          end
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.isActive : ""}`
          }
          data-testid="nav-all-boards"
        >
          {t("nav.allBoards")}
          <span className={styles.navItem__count}>{live.length}</span>
        </NavLink>

        <NavLink
          to="/dashboard/favorites"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.isActive : ""}`
          }
          data-testid="nav-favorites"
        >
          {t("nav.favorites")}
          <span className={styles.navItem__count}>
            {live.filter((b) => b.favorite).length}
          </span>
        </NavLink>

        <NavLink
          to="/dashboard/trash"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.isActive : ""}`
          }
          data-testid="nav-trash"
        >
          {t("nav.trash")}
          <span className={styles.navItem__count}>
            {boards.filter((b) => b.trashedAt !== null).length}
          </span>
        </NavLink>

        <NavLink
          to="/dashboard/activity"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.isActive : ""}`
          }
          data-testid="nav-activity"
        >
          {t("nav.activity")}
        </NavLink>

        <NavLink
          to="/dashboard/settings"
          className={({ isActive }) =>
            `${styles.navItem} ${isActive ? styles.isActive : ""}`
          }
          data-testid="nav-settings"
        >
          {t("nav.settings")}
        </NavLink>
      </nav>

      {/* Account state (STEP 3). Renders nothing when signed out in a build with no
          API, or while the session is still being read, so it never flashes a
          "Sign in" link at someone who is signed in. */}
      <AccountBlock
        user={authUser}
        loading={authLoading}
        onSignOut={() => {
          void authSignOut();
        }}
      />

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span>{t("nav.folders")}</span>
          <button
            type="button"
            className={styles.iconButton}
            onClick={() => setCreatingFolder(true)}
            aria-label={t("folder.create")}
            title={t("folder.create")}
            data-testid="new-folder"
          >
            +
          </button>
        </div>

        {creatingFolder ? (
          <form onSubmit={handleCreateFolder}>
            <input
              className={styles.newFolderInput}
              // eslint-disable-next-line jsx-a11y/no-autofocus -- the row only
              // exists because the user just clicked "+folder"
              autoFocus
              value={folderName}
              placeholder={t("folder.name.placeholder")}
              onChange={(e) => setFolderName(e.target.value)}
              onBlur={handleCreateFolder}
              data-testid="folder-name-input"
            />
          </form>
        ) : null}

        {roots.map((folder) => (
          <FolderRow
            key={folder.id}
            folderId={folder.id}
            name={folder.name}
            color={folder.color}
            count={countBoardsInFolder(boards, folder.id)}
          />
        ))}

        {roots.length === 0 && !creatingFolder ? (
          <div className={styles.navItem} data-testid="no-folders">
            {t("board.empty.folder")}
          </div>
        ) : null}
      </section>
    </aside>
  );
};

/** One folder row; registers itself as a dnd-kit droppable target. */
const FolderRow = ({
  folderId,
  name,
  color,
  count,
}: {
  folderId: string;
  name: string;
  color: string;
  count: number;
}) => {
  // Dropping a board card on this row files it into the folder (STEP 4).
  const { isOver, setNodeRef } = useFolderDroppable(folderId);

  return (
    <NavLink
      ref={setNodeRef}
      to={`/dashboard/folders/${folderId}`}
      className={({ isActive }) =>
        [
          styles.navItem,
          isActive ? styles.isActive : "",
          // Highlight while a board card hovers over the row.
          isOver ? styles.isDropTarget : "",
        ]
          .filter(Boolean)
          .join(" ")
      }
      data-testid={`folder-${folderId}`}
      data-folder-id={folderId}
      data-over={isOver || undefined}
    >
      <span
        className={styles.folderDot}
        style={{ background: FOLDER_COLOR_MAP[color] ?? FOLDER_COLOR_MAP.blue }}
      />
      {name}
      <span className={styles.navItem__count}>{count}</span>
    </NavLink>
  );
};

/**
 * Folder colour keys map to CSS colours here rather than storing hex in the
 * database, so a future dark theme can re-map them without a data migration.
 */
export const FOLDER_COLOR_MAP: Record<string, string> = {
  blue: "#3977df",
  green: "#2f9e6f",
  purple: "#8257d8",
  orange: "#e08c2b",
  pink: "#d65b9c",
  teal: "#2f9ea8",
  grey: "#8a94a6",
};
