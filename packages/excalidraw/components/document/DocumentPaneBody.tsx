/**
 * The document pane.
 *
 * A markdown notes pane beside the canvas, in the shape Eraser calls
 * document mode: the document alone, the document beside the canvas, or the
 * canvas alone. The pane owns the text; the canvas is untouched by any of
 * the view changes, so switching views can never disturb the scene.
 *
 * This is the body of the pane, and it is what the lazy chunk in
 * `DocumentPane` loads: the markdown parser and the renderer live behind it,
 * so a board that never opens the document never pays for them.
 */

import clsx from "clsx";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { t } from "../../i18n";

import {
  closeDocumentPane,
  DOCUMENT_VIEWS,
  setDocumentView,
  useDocumentView,
} from "./documentViewStore";

import { documentIcon } from "./icon";

import { MarkdownView } from "./MarkdownView";

import { parseMarkdown, toggleChecklistItem } from "./markdown";

import { getBoardId, loadNotes, saveNotes } from "./notesStorage";

import "./documentPane.scss";

import type { DocumentView } from "./documentViewStore";

/** how long typing has to pause before the notes are written to storage */
const SAVE_DEBOUNCE_MS = 400;

/** the label key for each view */
const VIEW_LABELS = {
  document: "labels.document.views.document",
  both: "labels.document.views.both",
  canvas: "labels.document.views.canvas",
} as const;

/** a starting document, so the pane is not a blank box on first open */
const STARTER_NOTES = `# Notes

Write the thinking behind the board here.

## Checklist

- [ ] Sketch the flow
- [ ] Agree the naming
- [x] Open the board

## Table

| Item | Owner | Status |
| --- | --- | --- |
| API | | todo |
| UI | | todo |

## Code

\`\`\`ts
const answer = 42;
\`\`\`

---

- a bullet
- another one
  1. nested
  2. and numbered
`;

/**
 * The pane.
 *
 * It renders nothing while the canvas view is showing, so a board that
 * never opens it carries no cost beyond the toolbar button — but the
 * component stays mounted, so the notes are never lost to a view change.
 */
export const DocumentPaneBody = () => {
  const view = useDocumentView();

  const [notes, setNotes] = useState<string>(() => {
    const stored = loadNotes(getBoardId());
    return stored === null ? STARTER_NOTES : stored;
  });

  /** the notes as they are on disk, so an unchanged document is not rewritten */
  const savedNotes = useRef<string>(notes);

  /**
   * The notes as they are *now*.
   *
   * The flush below runs from an effect with no dependencies, so it closes
   * over the first render's `notes` — the starter text. Reading the ref
   * instead means the flush writes what was actually typed, not what the
   * pane opened with.
   */
  const latestNotes = useRef<string>(notes);

  latestNotes.current = notes;

  /** whether the last write failed, so the pane can say so */
  const [saveFailed, setSaveFailed] = useState(false);

  const isVisible = view !== "canvas";

  /** writes the notes now */
  const persist = useCallback((value: string) => {
    if (value === savedNotes.current) {
      return;
    }

    const stored = saveNotes(value, getBoardId());
    savedNotes.current = value;
    setSaveFailed(!stored);
  }, []);

  // write the notes a moment after typing stops
  useEffect(() => {
    if (notes === savedNotes.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      persist(notes);
    }, SAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [notes, persist]);

  // and once more when the pane goes away, so a quick close does not lose
  // the last few keystrokes to the debounce
  useEffect(() => {
    return () => {
      persist(latestNotes.current);
    };
    // deliberately only on unmount: `persist` is stable and reads the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const blocks = useMemo(() => parseMarkdown(notes), [notes]);

  const toggleItem = useCallback((line: number) => {
    setNotes((current) => toggleChecklistItem(current, line));
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className={clsx("document-pane", `document-pane--${view}`)}
      data-testid="document-pane"
      data-view={view}
    >
      <div className="document-pane__header">
        <span className="document-pane__title">
          <span className="document-pane__icon">{documentIcon}</span>
          {t("labels.document.title")}
        </span>
        <div className="document-pane__header-actions">
          <button
            type="button"
            className="document-pane__header-button document-pane__header-button--close"
            onClick={closeDocumentPane}
            title={t("labels.document.close")}
            aria-label={t("labels.document.close")}
            data-testid="document-close"
          >
            ×
          </button>
        </div>
      </div>

      <div
        className="document-pane__views"
        role="tablist"
        aria-label={t("labels.document.views.label")}
      >
        {DOCUMENT_VIEWS.map((candidate: DocumentView) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={candidate === view}
            className={clsx("document-pane__view", {
              "document-pane__view--active": candidate === view,
            })}
            onClick={() => setDocumentView(candidate)}
            data-testid={`document-view-${candidate}`}
          >
            {t(VIEW_LABELS[candidate])}
          </button>
        ))}
      </div>

      <div className="document-pane__split">
        <div className="document-pane__column document-pane__column--write">
          <label
            className="document-pane__column-label"
            htmlFor="document-notes"
          >
            {t("labels.document.write")}
          </label>
          <textarea
            id="document-notes"
            className="document-pane__editor"
            data-testid="document-editor"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={() => persist(notes)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            aria-label={t("labels.document.write")}
          />
        </div>

        <div className="document-pane__column document-pane__column--preview">
          <span className="document-pane__column-label">
            {t("labels.document.preview")}
          </span>
          <div
            className="document-pane__preview"
            data-testid="document-preview"
          >
            <MarkdownView blocks={blocks} onToggleChecklistItem={toggleItem} />
          </div>
        </div>
      </div>

      {saveFailed && (
        <div className="document-pane__status" data-testid="document-status">
          {t("labels.document.notSaved")}
        </div>
      )}
    </div>
  );
};
