import { trackEvent } from "../../analytics";
import { t } from "../../i18n";

import { IconButton } from "../IconButton";
import { templatesIcon } from "../icons";

import type { AppClassProperties } from "../../types";

/**
 * The toolbar's way into the templates gallery.
 *
 * A template is not a tool — nothing stays selected after it is used — so
 * the button opens the gallery rather than arming anything.
 */
export const TemplatesButton = ({ app }: { app: AppClassProperties }) => {
  return (
    <IconButton
      type="button"
      icon={templatesIcon}
      title={t("labels.templates.title")}
      aria-label={t("labels.templates.title")}
      data-testid="toolbar-templates"
      onClick={() => {
        trackEvent("templates", "open", "toolbar");
        app.setOpenDialog({ name: "templates" });
      }}
    />
  );
};
