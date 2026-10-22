import clsx from "clsx";
import { useMemo, useState } from "react";

import { trackEvent } from "../../analytics";
import { t } from "../../i18n";
import { TEMPLATES } from "../../templates/catalogue";
import { insertTemplate } from "../../templates/insertTemplate";
import {
  getTemplatesByCategory,
  searchTemplates,
} from "../../templates/search";
import { TEMPLATE_CATEGORIES } from "../../templates/types";

import { useApp } from "../App";

import { TemplatePreview } from "./TemplatePreview";

import type {
  ExcalidrawTemplate,
  TemplateCategoryId,
} from "../../templates/types";

/**
 * The shelf of templates the gallery shows.
 *
 * This lives in a module of its own because it carries the whole catalogue
 * of templates with it: the gallery asks for it when it is opened, which
 * keeps the catalogue — and the drawing of a preview — out of the main
 * bundle. A board that never opens the gallery never pays for a template.
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

const TemplateGallery = ({
  query,
  category,
  onClose,
}: {
  /** what the search field holds */
  query: string;
  /** the category the gallery is narrowed down to, if any */
  category: TemplateCategoryId | null;
  /** called once a template has been put on the board */
  onClose: () => void;
}) => {
  const app = useApp();

  const templates = useMemo(
    () =>
      searchTemplates(
        getTemplatesByCategory(TEMPLATES, category),
        query,
        (template) => t(template.nameKey),
        (template) => t(template.descriptionKey),
      ),
    [query, category],
  );

  const useTemplate = (template: ExcalidrawTemplate) => {
    trackEvent("templates", "use", template.id);
    insertTemplate(app, template);
    onClose();
  };

  if (!templates.length) {
    return (
      <div className="templates-dialog__empty" data-testid="templates-empty">
        {t("labels.templates.empty")}
      </div>
    );
  }

  return (
    <div className="templates-dialog__grid" data-testid="templates-grid">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onUse={useTemplate}
        />
      ))}
    </div>
  );
};

export default TemplateGallery;
