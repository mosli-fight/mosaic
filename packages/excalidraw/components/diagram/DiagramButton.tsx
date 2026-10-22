import { t } from "../../i18n";

import { IconButton } from "../IconButton";

import { toggleDiagramPanel, useDiagramPanelOpen } from "./panelStore";

/**
 * The toolbar's way into the diagram pane.
 *
 * Like the assistant's button, this opens a surface rather than arming a
 * tool: nothing stays selected after it is used.
 */
export const diagramIcon = (
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

export const DiagramButton = () => {
  const isOpen = useDiagramPanelOpen();

  return (
    <IconButton
      type="button"
      icon={diagramIcon}
      title={t("labels.diagram.title")}
      aria-label={t("labels.diagram.title")}
      data-testid="toolbar-diagram"
      className={isOpen ? "ToolIcon--checked" : undefined}
      onClick={() => {
        toggleDiagramPanel();
      }}
    />
  );
};
