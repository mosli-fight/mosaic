import clsx from "clsx";
import { useState } from "react";

import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";
import {
  TEMPLATE_CATEGORIES,
  getTemplatesByCategory,
  searchTemplates,
} from "../../templates";
import { insertTemplate } from "../../templates/insertTemplate";

import { useApp } from "../App";
import { useExcalidrawSetAppState } from "../App";
import { Dialog } from "../Dialog";
import { TextField } from "../TextField";
import { trackEvent } from "../../analytics";

import { TemplatePreview } from "./TemplatePreview";

import "./templatesDialog.scss";

import type {
  ExcalidrawTemplate,
  TemplateCategoryId,
} from "../../templates/types";

/**
 * The templates gallery: a Miro-style shelf of ready-made boards.
 *
 * The gallery is a dialog rather than a sidebar because a template is a
 * one-off thing — you reach for it, you take what you need, and you get back
 * to the board.
 */

const getCategoryLabelKey = (category: TemplateCategoryId) =>
  TEMPLATE_CATEGORIES.find((entry) => entry.id === category)?.labelKey ??
  "labels.templates.all";

const TemplateCard = ({
  template,
  onUse,
}: {
  template: ExcalidrawTemplate;
  onUse: (template: ExcalidrawTemplate) => void;
}) => {
  const [isPreviewing, setIsPreviewing] = useState(false);
  const name = t(template.nameKey);
  const description = t(template.descriptionKey);

  return (
    <div
      className="templates-card"
      data-testid={`templates-card-${template.id}`}
    >
      <div
        className={clsx("templates-card__preview", {
          "templates-card__preview--large": isPreviewing,
        })}
      >
        <TemplatePreview template={template} label={name} />
      </div>

      <div className="templates-card__body">
        <h4 className="templates-card__name">{name}</h4>
        <div className="templates-card__category">
          {t(getCategoryLabelKey(template.category))}
        </div>
        <p className="templates-card__description">{description}</p>
      </div>

      <div className="templates-card__actions">
        <button
          type="button"
          className="templates-card__action"
          data-testid={`templates-preview-${template.id}`}
          onClick={() => setIsPreviewing((previewing) => !previewing)}
        >
          {isPreviewing
            ? t("labels.templates.hidePreview")
            : t("labels.templates.preview")}
        </button>
        <button
          type="button"
          className="templates-card__action templates-card__action--primary"
          data-testid={`templates-use-${template.id}`}
          onClick={() => onUse(template)}
        >
          {t("labels.templates.use")}
        </button>
      </div>
    </div>
  );
};

export const TemplatesDialog = () => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const app = useApp();

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategoryId | null>(null);

  if (appState.openDialog?.name !== "templates") {
    return null;
  }

  const templates = searchTemplates(
    getTemplatesByCategory(category),
    query,
    (template) => t(template.nameKey),
    (template) => t(template.descriptionKey),
  );

  const close = () => setAppState({ openDialog: null });

  const useTemplate = (template: ExcalidrawTemplate) => {
    trackEvent("templates", "use", template.id);
    insertTemplate(app, template);
    close();
  };

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

      {templates.length ? (
        <div className="templates-dialog__grid" data-testid="templates-grid">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onUse={useTemplate}
            />
          ))}
        </div>
      ) : (
        <div className="templates-dialog__empty" data-testid="templates-empty">
          {t("labels.templates.empty")}
        </div>
      )}
    </Dialog>
  );
};
