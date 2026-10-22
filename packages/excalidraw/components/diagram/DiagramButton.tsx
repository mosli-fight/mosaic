import { t } from "../../i18n";

import { IconButton } from "../IconButton";

import { diagramIcon } from "./icon";
import { toggleDiagramPanel, useDiagramPanelOpen } from "./panelStore";

/**
 * The toolbar's way into the diagram pane.
 *
 * Like the assistant's button, this opens a surface rather than arming a
 * tool: nothing stays selected after it is used.
 */
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
