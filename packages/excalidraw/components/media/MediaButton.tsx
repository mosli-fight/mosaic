import { trackEvent } from "../../analytics";
import { t } from "../../i18n";

import { IconButton } from "../IconButton";
import { mediaIcon } from "../icons";

import type { AppClassProperties } from "../../types";

/**
 * The toolbar's way into the media panel.
 *
 * Media is not a tool — nothing stays selected after it is used — so the
 * button opens the panel rather than arming anything.
 */
export const MediaButton = ({ app }: { app: AppClassProperties }) => {
  return (
    <IconButton
      type="button"
      icon={mediaIcon}
      title={t("labels.media.title")}
      aria-label={t("labels.media.title")}
      data-testid="toolbar-media"
      onClick={() => {
        trackEvent("media", "open", "toolbar");
        app.setOpenDialog({ name: "media" });
      }}
    />
  );
};
