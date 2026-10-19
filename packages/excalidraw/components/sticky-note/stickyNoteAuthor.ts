import type { AppState } from "../../types";

/**
 * Who is creating this note: the name of the current user, if the editor
 * knows one.
 *
 * Two sources, in order: the collaborator entry of the current user — a live
 * session knows the name even before the user sets one — and the name the
 * user chose in the share dialog. `null` when the editor knows neither: a
 * note without an author is perfectly normal, and its footer simply omits
 * the name.
 */
export const getStickyNoteAuthor = (appState: AppState): string | null => {
  for (const collaborator of appState.collaborators.values()) {
    if (collaborator.isCurrentUser && collaborator.username) {
      return collaborator.username;
    }
  }
  return appState.name || null;
};
