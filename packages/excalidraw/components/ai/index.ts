/**
 * The AI assistant.
 *
 * A bring-your-own-key assistant: the user says which provider to talk to,
 * and the requests go from their browser to that provider and nowhere else.
 */

export { AIAssistantPanel } from "./AIAssistantPanel";
export { AIAssistantButton } from "./AIAssistantButton";
export { AIPresetsSection } from "./AIPresetsSection";
export { AIStarterRow } from "./AIStarterRow";
export {
  closeAIPanel,
  openAIPanel,
  toggleAIPanel,
  useAIPanelOpen,
} from "./aiPanelStore";
export { AIApiError, buildChatCompletionsUrl, sendChatCompletion } from "./api";
export { extractJsonArray, parseDiagramElements } from "./diagramParser";
export {
  AI_PRESETS_STORAGE_KEY,
  createPreset,
  DEFAULT_AI_PRESETS,
  deletePreset,
  getActivePreset,
  getActivePresetRules,
  loadAIPresets,
  renamePreset,
  saveAIPresets,
  setActivePreset,
  updatePresetRules,
} from "./presets";
export { DIAGRAM_STARTERS } from "./starters";
export {
  AI_SETTINGS_STORAGE_KEY,
  clearAISettings,
  isAISettingsConfigured,
  loadAISettings,
  normalizeBaseUrl,
  saveAISettings,
} from "./storage";

export type { AIDiagramStarter, AIDiagramStarterId } from "./starters";
export type {
  AIChatEntry,
  AIChatMessage,
  AIDiagramElementKind,
  AIDiagramElementSpec,
  AIPreset,
  AIPresetsState,
  AISettings,
} from "./types";
