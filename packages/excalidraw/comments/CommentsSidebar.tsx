import { t } from "../i18n";
import { Sidebar } from "../components/Sidebar/Sidebar";

import { CommentsPanel } from "./CommentsPanel";

export const COMMENTS_SIDEBAR_NAME = "comments";

/**
 * The comments sidebar — the activity feed of every comment on the canvas.
 *
 * Rendered next to the default sidebar, so opening it swaps the two (only
 * one sidebar is shown at a time).
 */
export const CommentsSidebar = () => (
  <Sidebar
    name={COMMENTS_SIDEBAR_NAME}
    key={COMMENTS_SIDEBAR_NAME}
    className="comments-sidebar"
  >
    <Sidebar.Header>
      <span className="comments-sidebar__title">{t("comment.panelTitle")}</span>
    </Sidebar.Header>
    <CommentsPanel />
  </Sidebar>
);
