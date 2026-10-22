import { deburr } from "../deburr";

import type { ExcalidrawTemplate, TemplateCategoryId } from "./types";

/**
 * The gallery's way of finding templates.
 *
 * These are pure functions over a list of templates, which is why they live
 * apart from the catalogue itself: the gallery can search and filter while
 * the catalogue is still on its way.
 */

/**
 * The templates of a category, in the order the gallery lists them.
 * `null` means every category.
 */
export const getTemplatesByCategory = (
  templates: readonly ExcalidrawTemplate[],
  category: TemplateCategoryId | null,
): readonly ExcalidrawTemplate[] =>
  category
    ? templates.filter((template) => template.category === category)
    : templates;

/**
 * The templates whose name or description matches the query.
 *
 * The match is a case- and accent-insensitive substring, so that "kanban"
 * finds the Kanban board and "retro" finds the retrospective.
 */
export const searchTemplates = (
  templates: readonly ExcalidrawTemplate[],
  query: string,
  /** the name of a template, in the language the gallery is shown in */
  getName: (template: ExcalidrawTemplate) => string,
  /** the description of a template, in the language the gallery is shown in */
  getDescription: (template: ExcalidrawTemplate) => string,
): readonly ExcalidrawTemplate[] => {
  const trimmed = query.trim();

  if (!trimmed) {
    return templates;
  }

  const needle = deburr(trimmed.toLowerCase());

  return templates.filter((template) => {
    const haystack = deburr(
      `${getName(template)} ${getDescription(template)}`.toLowerCase(),
    );
    return haystack.includes(needle);
  });
};
