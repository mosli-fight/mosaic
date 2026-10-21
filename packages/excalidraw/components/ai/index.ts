/**
 * The AI assistant.
 *
 * A bring-your-own-key assistant: the user says which provider to talk to,
 * and the requests go from their browser to that provider and nowhere else.
 */

export { AIAssistantPanel } from "./AIAssistantPanel";
export { AIAssistantButton } from "./AIAssistantButton";
export {
  closeAIPanel,
  openAIPanel,
  toggleAIPanel,
  useAIPanelOpen,
} from "./aiPanelStore";
export { AIApiError, buildChatCompletionsUrl, sendChatCompletion } from "./api";
export { extractJsonArray, parseDiagramElements } from "./diagramParser";
export {
  AI_SETTINGS_STORAGE_KEY,
  clearAISettings,
  isAISettingsConfigured,
  loadAISettings,
  normalizeBaseUrl,
  saveAISettings,
} from "./storage";

export type {
  AIChatEntry,
  AIChatMessage,
  AIDiagramElementKind,
  AIDiagramElementSpec,
  AISettings,
} from "./types";
