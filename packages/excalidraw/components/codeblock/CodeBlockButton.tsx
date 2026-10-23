import { t } from "../../i18n";

import { IconButton } from "../IconButton";
import { codeIcon } from "../icons";

import type { AppClassProperties } from "../../types";

/**
 * The toolbar's way onto a code block.
 *
 * Like the media and document buttons, this is not a tool: pressing it puts
 * a block in the middle of the viewport, selected and open for typing, and
 * leaves the selection tool armed — a block is something you write into,
 * not something you draw.
 */
export const CodeBlockButton = ({ app }: { app: AppClassProperties }) => {
  return (
    <IconButton
      type="button"
      icon={codeIcon}
      title={t("toolBar.codeblock")}
      aria-label={t("toolBar.codeblock")}
      data-testid="toolbar-codeblock"
      onClick={() => {
        app.insertCodeBlock();
      }}
    />
  );
};
