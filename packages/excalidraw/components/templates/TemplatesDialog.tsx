import clsx from "clsx";
import { lazy, Suspense, useState } from "react";

import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import { TEMPLATE_CATEGORIES } from "../../templates/types";

import { useExcalidrawSetAppState } from "../App";
import { Dialog } from "../Dialog";
import { TextField } from "../TextField";

import "./templatesDialog.scss";

import type { TemplateCategoryId } from "../../templates/types";

/**
 * The templates gallery: a Miro-style shelf of ready-made boards.
 *
 * The gallery is a dialog rather than a sidebar because a template is a
 * one-off thing — you reach for it, you take what you need, and you get back
 * to the board.
 *
 * The shelf itself — the catalogue of templates and the drawing of a preview
 * — is fetched only when the gallery is opened: a board that never opens the
 * gallery does not carry the catalogue with it.
 */
const TemplateGallery = lazy(() => import("./TemplateGallery"));

export const TemplatesDialog = () => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategoryId | null>(null);

  if (appState.openDialog?.name !== "templates") {
    return null;
  }

  const close = () => setAppState({ openDialog: null });

  return (
    <Dialog
      onCloseRequest={close}
      title={t("labels.templates.title")}
      size="wide"
      className="templates-dialog"
    >
      <div className="templates-dialog__toolbar">
        <div
          className="templates-dialog__search"
          data-testid="templates-search"
        >
          <TextField
            value={query}
            placeholder={t("labels.templates.search")}
            onChange={(value) => setQuery(value)}
            selectOnRender
          />
        </div>
        <div className="templates-dialog__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={category === null}
            className={clsx("templates-dialog__tab", {
              "templates-dialog__tab--active": category === null,
            })}
            data-testid="templates-tab-all"
            onClick={() => setCategory(null)}
          >
            {t("labels.templates.all")}
          </button>
          {TEMPLATE_CATEGORIES.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={category === entry.id}
              className={clsx("templates-dialog__tab", {
                "templates-dialog__tab--active": category === entry.id,
              })}
              data-testid={`templates-tab-${entry.id}`}
              onClick={() => setCategory(entry.id)}
            >
              {t(entry.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <Suspense
        fallback={
          <div
            className="templates-dialog__loading"
            data-testid="templates-loading"
          >
            {t("labels.templates.loading")}
          </div>
        }
      >
        <TemplateGallery query={query} category={category} onClose={close} />
      </Suspense>
    </Dialog>
  );
};
