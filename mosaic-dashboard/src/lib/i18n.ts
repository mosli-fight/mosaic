/**
 * Minimal i18n layer.
 *
 * Part 2 requires English-only copy that is "i18n-ready", i.e. every user-facing
 * string must go through `t()`. Rather than pull in a full i18n library for a
 * single locale, this is a thin, typed wrapper that will later be pointed at the
 * same locale files the editor already ships (`packages/excalidraw/locales`).
 *
 * Why not reuse the editor's i18n module directly:
 * `packages/excalidraw/i18n.ts` boots a React context, loads ~58 JSON locale
 * bundles and pulls in the whole editor render tree. Dragging that into a
 * dashboard that never renders an editor would be a large coupling for zero
 * benefit. When the dashboard needs real translations we swap the dictionary
 * below for locale imports; the call sites do not change.
 */

type Dictionary = Record<string, string>;

/**
 * Flat key -> English string. Keys are namespaced by area (`board.action.open`)
 * so a real backend can be swapped in without touching call sites.
 */
const en: Dictionary = {
  "app.title": "Mosaic",
  "app.tagline": "Your boards, all in one place",

  "nav.allBoards": "All boards",
  "nav.favorites": "Favorites",
  "nav.trash": "Trash",
  "nav.activity": "Activity",
  "nav.settings": "Settings",
  "nav.folders": "Folders",
  "nav.newBoard": "New board",
  "nav.newFolder": "New folder",

  "board.empty.title": "No boards yet",
  "board.empty.description": "Create your first board to start sketching.",
  "board.empty.action": "New board",
  "board.empty.filtered": "Nothing matches your filters.",
  "board.empty.favorites": "You have not favorited any boards yet.",
  "board.empty.trash": "Trash is empty.",
  "board.empty.folder": "This folder is empty.",
  "board.loading": "Loading boards",

  "board.action.open": "Open",
  "board.action.rename": "Rename",
  "board.action.duplicate": "Duplicate",
  "board.action.move": "Move to folder",
  "board.action.download": "Download",
  "board.action.trash": "Move to trash",
  "board.action.share": "Share",
  "board.share.title": "Share this board",
  "board.share.intro":
    "Anyone with the link can view this board. They do not need an account, and they cannot edit it.",
  "board.share.copy": "Copy link",
  "board.share.copied": "Copied",
  "board.share.revoke": "Stop sharing",
  "board.share.revoked": "Sharing stopped. The link no longer works.",
  "board.share.failed": "Could not share this board.",
  "board.action.restore": "Restore",
  "board.action.deleteForever": "Delete forever",
  "board.delete.title": "Delete this board forever?",
  "board.delete.body":
    '"{name}" will be permanently deleted. This cannot be undone.',
  "board.action.favorite": "Add to favorites",
  "board.action.unfavorite": "Remove from favorites",
  "board.action.unfiled": "Unfiled",

  "board.download.mosaic": "Mosaic (.mosaic)",
  "board.download.excalidraw": "Excalidraw JSON (.excalidraw)",
  "board.download.png": "PNG image",
  "board.download.svg": "SVG image",

  "board.rename.placeholder": "Board name",
  "board.rename.save": "Save name",
  "board.untitled": "Untitled board",
  "board.card.editsWeek": "{edits} · last 7 days",
  "board.card.editsWeekTitle": "{edits} all time",

  "board.bulk.selected": "{count} selected",
  "board.bulk.clear": "Clear selection",
  "board.bulk.trash": "Trash selected",
  "board.bulk.favorite": "Favorite selected",
  "board.bulk.move": "Move selected",

  "toolbar.search": "Search boards",
  "toolbar.sort": "Sort",
  "toolbar.sort.recent": "Last opened",
  "toolbar.sort.name": "Name",
  "toolbar.sort.created": "Date created",
  "toolbar.sort.size": "Size",
  "toolbar.view": "View",

  "folder.create": "Create folder",
  "folder.rename": "Rename folder",
  "folder.recolor": "Change color",
  "folder.delete": "Delete folder",
  "folder.name.placeholder": "Folder name",
  "folder.unfiled": "Unfiled",

  "activity.title": "Activity",
  "activity.empty": "No activity yet.",
  "activity.type.create": "created",
  "activity.type.open": "opened",
  "activity.type.rename": "renamed",
  "activity.type.delete": "moved to trash",
  "activity.type.favorite": "updated favorite on",
  "activity.type.move": "moved",
  "activity.stats": "{count} edits · {recent} this week",

  "trash.title": "Trash",
  "trash.purgeIn": "Auto-deletes in {days} days",
  "trash.purgeSoon": "Auto-deletes today",
  "trash.empty": "Trash is empty. Deleted boards appear here for 30 days.",

  "settings.title": "Settings",
  "settings.storage": "Storage",
  "settings.usage": "Using {boards} and {folders}",
  "settings.reset": "Delete all local data",
  "settings.resetConfirm": "This permanently deletes every board and folder.",

  "editor.back": "Back to dashboard",
  "editor.unsaved": "Saving…",
  "editor.saved": "Saved",
  "editor.save": "Save now",
  "editor.saveShortcut": "Save (Ctrl+S)",
  "editor.thumbnailFailed": "Could not generate preview",

  "common.confirm": "Confirm",
  "common.cancel": "Cancel",
  "common.close": "Close",
  "common.more": "More options",
  "common.delete": "Delete",
  "common.rename": "Rename",
  "common.done": "Done",
  "common.back": "Back",
};

/** Active locale. Only English ships in Part 2. */
let activeLocale = "en";

const dictionaries: Record<string, Dictionary> = { en };

/**
 * Translates `key`, interpolating `{name}` placeholders from `values`.
 *
 * Falls back to the key itself if a translation is missing, which makes missing
 * strings obvious in the UI instead of rendering an empty label.
 *
 * @example
 *   t("nav.allBoards")                       // "All boards"
 *   t("activity.stats", { count: 3, recent: 2 })
 */
export function t(
  key: string,
  values?: Record<string, string | number>,
): string {
  const dict = dictionaries[activeLocale] ?? en;
  const template = dict[key] ?? key;

  if (!values) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

/** Switches locale. No-op for locales that have no dictionary yet. */
export function setLocale(locale: string): void {
  if (dictionaries[locale]) {
    activeLocale = locale;
  }
}

export const getLocale = (): string => activeLocale;

/** Every key, for tests that assert copy is fully wired up. */
export const translationKeys = (): string[] => Object.keys(en);

/**
 * Exposed for the Settings page: a pick-list of strings the user can override
 * locally. Not wired up in Part 2, but the plumbing (and the `t()` call sites)
 * already exist so adding it later is a UI change only.
 */
export const availableLocales = (): string[] => Object.keys(dictionaries);
