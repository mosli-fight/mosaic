/**
 * The built-in templates: the gallery's catalogue, in the order it shows it.
 *
 * The templates are *data* — each one is a list of element specs, built into
 * real elements by `buildTemplateElements` when it is used. Keeping the
 * catalogue here (rather than in the gallery) means the templates can be
 * listed, searched and previewed without the editor's UI being involved.
 */

import { deburr } from "../deburr";

import { brainstormingTemplate } from "./brainstorming";
import { flowchartStarterTemplate } from "./flowchartStarter";
import { kanbanBoardTemplate } from "./kanbanBoard";
import { meetingAgendaTemplate } from "./meetingAgenda";
import { mindMapTemplate } from "./mindMap";
import { projectTimelineTemplate } from "./projectTimeline";
import { retroBoardTemplate } from "./retroBoard";
import { swotAnalysisTemplate } from "./swotAnalysis";
import { userJourneyMapTemplate } from "./userJourneyMap";
import { wireframeBasicsTemplate } from "./wireframeBasics";

import type { ExcalidrawTemplate, TemplateCategoryId } from "./types";

export * from "./types";
export * from "./builder";

/**
 * The built-in templates, in the order the gallery lists them.
 *
 * ORDER matters: it is the order the cards appear in when no category and no
 * search narrow the gallery down.
 */
export const TEMPLATES: readonly ExcalidrawTemplate[] = [
  brainstormingTemplate,
  meetingAgendaTemplate,
  kanbanBoardTemplate,
  mindMapTemplate,
  swotAnalysisTemplate,
  projectTimelineTemplate,
  retroBoardTemplate,
  userJourneyMapTemplate,
  wireframeBasicsTemplate,
  flowchartStarterTemplate,
];

/** the template with the given id, if there is one */
export const getTemplateById = (id: string): ExcalidrawTemplate | undefined =>
  TEMPLATES.find((template) => template.id === id);

/**
 * The templates of a category, in the order the gallery lists them.
 * `null` means every category.
 */
export const getTemplatesByCategory = (
  category: TemplateCategoryId | null,
): readonly ExcalidrawTemplate[] =>
  category
    ? TEMPLATES.filter((template) => template.category === category)
    : TEMPLATES;

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
