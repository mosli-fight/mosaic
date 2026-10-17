import { useEffect, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";

import styles from "./AppShell.module.scss";

import { Sidebar } from "@/components/sidebar/Sidebar";
import { DndProvider } from "@/components/dnd/DndProvider";
import { useDashboardStore } from "@/state/useDashboardStore";
import { useThemeStore } from "@/state/useThemeStore";

/**
 * Two-column app shell: persistent sidebar + scrolling content area.
 *
 * The shell is deliberately dumb — it owns layout only. Route components own
 * their own headers and toolbars, which keeps the sidebar usable from every page
 * without each page re-implementing the two-column grid.
 *
 * `DndProvider` wraps both columns because the drag source (board grid) and the
 * drop targets (sidebar folder rows) live in different columns; a dnd-kit context
 * only reaches its own subtree.
 *
 * ## Why it also re-reads on navigation
 *
 * Every count in the sidebar — all boards, favorites, trash, per-folder — is
 * derived from one cached read that `App` performs once at boot. Anything that
 * changes a board without going through that read (the editor autosaving through
 * the iframe bridge, a second tab starring a board, a background import) left the
 * counts stale until a full reload, and "correct after navigating away and back"
 * was only true by accident of remounting.
 *
 * The read is `background`, so it does not put the shell back into its loading
 * state: the rows already on screen stay on screen until fresher ones arrive. A
 * foreground reload here would trade a stale count for a skeleton on every click,
 * which is the flash this is meant to remove.
 */
export const AppShell = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const reload = useDashboardStore((s) => s.reload);
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void reload({ background: true });
  }, [reload, location.pathname]);

  useEffect(() => {
    const el = rootRef.current;
    if (el) {
      el.setAttribute("data-theme", resolvedTheme);
    }
  }, [resolvedTheme]);

  return (
    <div ref={rootRef} className={`dashboardRoot ${styles.shell}`}>
      <DndProvider>
        <Sidebar />
        <div className={styles.shell__main}>
          <div className={styles.shell__content}>{children}</div>
        </div>
      </DndProvider>
    </div>
  );
};
