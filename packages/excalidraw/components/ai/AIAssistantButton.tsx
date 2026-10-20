import { trackEvent } from "../../analytics";
import { t } from "../../i18n";

import { IconButton } from "../IconButton";

import { toggleAIPanel, useAIPanelOpen } from "./aiPanelStore";
import { aiIcon } from "./icons";

/**
 * The toolbar's way into the assistant.
 *
 * The panel is a surface of the editor rather than a tool: nothing stays
 * selected after it is used, so the button opens the panel rather than
 * arming anything.
 */
export const AIAssistantButton = () => {
  const isOpen = useAIPanelOpen();

  return (
    <IconButton
      type="button"
      icon={aiIcon}
      title={t("labels.ai.title")}
      aria-label={t("labels.ai.title")}
      data-testid="toolbar-ai"
      className={isOpen ? "ToolIcon--checked" : undefined}
      onClick={() => {
        trackEvent("ai", "toggle", "toolbar");
        toggleAIPanel();
      }}
    />
  );
};
