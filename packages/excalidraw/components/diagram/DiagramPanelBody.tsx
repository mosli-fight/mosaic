/**
 * The diagram-as-code pane.
 *
 * A code editor beside the canvas: what is typed here is drawn there, and a
 * label edited on the canvas is written back here. The pane owns the text
 * and the type selector; the drawing is the editor's.
 *
 * This is the body of the pane, and it is what the lazy chunk in
 * `DiagramPanel` loads: the parser, the layout and the scene builder all
 * live behind it, so a board that never opens the pane never pays for them.
 */

import clsx from "clsx";

import { useCallback, useEffect, useRef, useState } from "react";

import { THEME } from "@excalidraw/common";

import { t } from "../../i18n";

import { DIAGRAM_TYPES } from "../../diagramTypes";

import { useApp, useExcalidrawAppState } from "../App";

import { closeDiagramPanel, useDiagramPanelOpen } from "./panelStore";

import {
  applyCanvasRenames,
  DiagramSyncGuard,
  exampleFor,
  findCanvasRenames,
  hasDiagramOnBoard,
  syncCodeToScene,
} from "./sync";

import "./diagramPanel.scss";

import type { DiagramParseError, DiagramType } from "./types";

/** how long typing has to pause before the canvas is redrawn */
const DEBOUNCE_MS = 300;

/** the label key for each type */
const DIAGRAM_TYPE_LABELS = {
  flowchart: "labels.diagram.types.flowchart",
  architecture: "labels.diagram.types.architecture",
  erd: "labels.diagram.types.erd",
  sequence: "labels.diagram.types.sequence",
} as const;

/** the pane's title, and its icon */
const diagramIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    role="img"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="16" width="7" height="5" rx="1" />
    <path d="M6.5 8v4a2 2 0 0 0 2 2h9a2 2 0 0 1 2 2v0" />
  </svg>
);

/**
 * The pane.
 *
 * It renders nothing while it is closed, so a board that never opens it
 * carries no cost beyond the toolbar button.
 */
export const DiagramPanelBody = () => {
  const app = useApp();
  const appState = useExcalidrawAppState();
  const isOpen = useDiagramPanelOpen();

  const [code, setCode] = useState<string>(appState.diagramCode);
  const [type, setType] = useState<DiagramType>(appState.diagramType);
  const [errors, setErrors] = useState<DiagramParseError[]>([]);
  const [status, setStatus] = useState<"idle" | "drawn" | "error">("idle");

  /** the guard that stops a code-driven scene update from looking like an edit */
  const guard = useRef(new DiagramSyncGuard());

  /** the code the canvas currently reflects, so a rename can be diffed */
  const appliedCode = useRef<string>(appState.diagramCode);

  /** whether the pane has seeded an example on this board */
  const seeded = useRef(false);

  const isDark = appState.theme === THEME.DARK;

  /**
   * Puts the code on the canvas.
   *
   * Runs inside the guard, so the change the editor reports back is ignored
   * rather than read as a canvas edit.
   */
  const draw = useCallback(
    (nextCode: string, nextType: DiagramType) => {
      const result = syncCodeToScene(
        app.api.getSceneElementsIncludingDeleted(),
        nextCode,
        nextType,
      );

      setErrors(result.errors);
      setStatus(result.errors.length ? "error" : "drawn");

      if (result.errors.length) {
        // the last good scene stays: a half-typed line must not wipe the board
        return;
      }

      guard.current.run(() => {
        app.api.updateScene({
          elements: result.elements,
          appState: { diagramCode: nextCode, diagramType: nextType },
        });
      });

      appliedCode.current = nextCode;
    },
    [app],
  );

  // seed an example the first time the pane is opened on an empty board
  useEffect(() => {
    if (!isOpen || seeded.current) {
      return;
    }

    seeded.current = true;

    if (
      appState.diagramCode.trim() ||
      hasDiagramOnBoard(app.api.getSceneElements())
    ) {
      setCode(appState.diagramCode);
      setType(appState.diagramType);
      return;
    }

    const example = exampleFor(appState.diagramType);
    setCode(example);
    setType(appState.diagramType);
    draw(example, appState.diagramType);
    // deliberately runs once per open; the guard ref keeps it to one seed
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // debounce typing into a redraw
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (code === appliedCode.current) {
      return;
    }

    const timer = window.setTimeout(() => {
      draw(code, type);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [code, type, isOpen, draw]);

  // canvas → code: a label edited on the canvas goes back into its line
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const unsubscribe = app.api.onChange((elements) => {
      if (guard.current.isApplying) {
        return;
      }

      const renames = findCanvasRenames(elements, appliedCode.current, type);

      if (!renames.length) {
        return;
      }

      const applied = applyCanvasRenames(appliedCode.current, renames, type);

      if (!applied) {
        return;
      }

      // the code is now the source of truth again; redraw from it so the
      // canvas and the text agree, including any re-layout the rename caused
      appliedCode.current = applied.code;
      setCode(applied.code);
      draw(applied.code, type);
    });

    return unsubscribe;
  }, [app, isOpen, type, draw]);

  const changeType = useCallback(
    (nextType: DiagramType) => {
      setType(nextType);
      draw(code, nextType);
    },
    [code, draw],
  );

  const close = useCallback(() => {
    closeDiagramPanel();
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className={clsx("diagram-panel", { "diagram-panel--dark": isDark })}
      data-testid="diagram-panel"
    >
      <div className="diagram-panel__header">
        <span className="diagram-panel__title">
          <span className="diagram-panel__icon">{diagramIcon}</span>
          {t("labels.diagram.title")}
        </span>
        <div className="diagram-panel__header-actions">
          <button
            type="button"
            className="diagram-panel__header-button diagram-panel__header-button--close"
            onClick={close}
            title={t("labels.diagram.close")}
            aria-label={t("labels.diagram.close")}
            data-testid="diagram-close"
          >
            ×
          </button>
        </div>
      </div>

      <div className="diagram-panel__types" role="tablist">
        {DIAGRAM_TYPES.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={candidate === type}
            className={clsx("diagram-panel__type", {
              "diagram-panel__type--active": candidate === type,
            })}
            onClick={() => changeType(candidate)}
            data-testid={`diagram-type-${candidate}`}
          >
            {t(DIAGRAM_TYPE_LABELS[candidate])}
          </button>
        ))}
      </div>

      <textarea
        className="diagram-panel__editor"
        data-testid="diagram-editor"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        wrap="off"
        aria-label={t("labels.diagram.title")}
      />

      {errors.length ? (
        <div className="diagram-panel__errors" data-testid="diagram-errors">
          {errors.slice(0, 5).map((error) => (
            <div
              key={`${error.line}:${error.message}`}
              className="diagram-panel__error"
            >
              <span className="diagram-panel__error-line">{error.line}</span>
              {error.message}
            </div>
          ))}
        </div>
      ) : (
        <div className="diagram-panel__hint" data-testid="diagram-hint">
          {status === "drawn"
            ? t("labels.diagram.drawn")
            : t("labels.diagram.hint")}
        </div>
      )}
    </div>
  );
};
