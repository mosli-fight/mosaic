import { t } from "../../i18n";

import { IconButton } from "../IconButton";

import { toggleDocumentPane, useDocumentView } from "./documentViewStore";

import { documentIcon } from "./icon";

/**
 * The toolbar's way into the document pane.
 *
 * Like the assistant's and the diagram's buttons, this opens a surface
 * rather than arming a tool: nothing stays selected after it is used.
 */
export const DocumentButton = () => {
  const view = useDocumentView();
  const isOpen = view !== "canvas";

  return (
    <IconButton
      type="button"
      icon={documentIcon}
      title={`${t("labels.document.title")} — ${t("labels.document.shortcut")}`}
      aria-label={t("labels.document.title")}
      aria-keyshortcuts="Alt+N"
      data-testid="toolbar-document"
      className={isOpen ? "ToolIcon--checked" : undefined}
      onClick={() => {
        toggleDocumentPane();
      }}
    />
  );
};
