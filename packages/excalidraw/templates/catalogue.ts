/**
 * The built-in templates: the gallery's catalogue, in the order it shows it.
 *
 * The templates are *data* — each one is a list of element specs, built into
 * real elements by `buildTemplateElements` when it is used. Keeping the
 * catalogue here (rather than in the gallery) means the templates can be
 * listed, searched and previewed without the editor's UI being involved.
 *
 * This module carries the whole catalogue with it, and the catalogue is
 * large enough to matter to the bundle, so it lives in a chunk of its own:
 * the gallery asks for it when it is opened, and a board that never opens
 * the gallery never pays for it.
 */

import { brainstormingTemplate } from "./brainstorming";
import { bugTriageBoardTemplate } from "./bugTriageBoard";
import { businessModelCanvasTemplate } from "./businessModelCanvas";
import { costBenefitAnalysisTemplate } from "./costBenefitAnalysis";
import { decisionTreeTemplate } from "./decisionTree";
import { dotVotingBoardTemplate } from "./dotVotingBoard";
import { empathyMapTemplate } from "./empathyMap";
import { flowchartStarterTemplate } from "./flowchartStarter";
import { howMightWeTemplate } from "./howMightWe";
import { kanbanBoardTemplate } from "./kanbanBoard";
import { leanCanvasTemplate } from "./leanCanvas";
import { meetingAgendaTemplate } from "./meetingAgenda";
import { meetingNotesTemplate } from "./meetingNotes";
import { mindMapTemplate } from "./mindMap";
import { okrPlanningTemplate } from "./okrPlanning";
import { orgChartTemplate } from "./orgChart";
import { personaCardTemplate } from "./personaCard";
import { prioritizationMatrixTemplate } from "./prioritizationMatrix";
import { projectTimelineTemplate } from "./projectTimeline";
import { quarterlyRoadmapTemplate } from "./quarterlyRoadmap";
import { retroBoardTemplate } from "./retroBoard";
import { sequenceDiagramTemplate } from "./sequenceDiagram";
import { serviceBlueprintTemplate } from "./serviceBlueprint";
import { sixThinkingHatsTemplate } from "./sixThinkingHats";
import { sprintBoardTemplate } from "./sprintBoard";
import { startStopContinueTemplate } from "./startStopContinue";
import { swotAnalysisTemplate } from "./swotAnalysis";
import { timeboxedAgendaTemplate } from "./timeboxedAgenda";
import { userJourneyMapTemplate } from "./userJourneyMap";
import { userStoryMapTemplate } from "./userStoryMap";
import { vennDiagramTemplate } from "./vennDiagram";
import { wireframeBasicsTemplate } from "./wireframeBasics";

import type { ExcalidrawTemplate } from "./types";

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
  meetingNotesTemplate,
  startStopContinueTemplate,
  timeboxedAgendaTemplate,
  dotVotingBoardTemplate,
  howMightWeTemplate,
  sixThinkingHatsTemplate,
  empathyMapTemplate,
  serviceBlueprintTemplate,
  personaCardTemplate,
  userStoryMapTemplate,
  sprintBoardTemplate,
  bugTriageBoardTemplate,
  prioritizationMatrixTemplate,
  okrPlanningTemplate,
  quarterlyRoadmapTemplate,
  vennDiagramTemplate,
  sequenceDiagramTemplate,
  decisionTreeTemplate,
  businessModelCanvasTemplate,
  leanCanvasTemplate,
  costBenefitAnalysisTemplate,
  orgChartTemplate,
];

/** the template with the given id, if there is one */
export const getTemplateById = (id: string): ExcalidrawTemplate | undefined =>
  TEMPLATES.find((template) => template.id === id);
