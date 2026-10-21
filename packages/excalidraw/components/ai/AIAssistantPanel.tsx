/**
 * The AI assistant panel.
 *
 * A sidekick for the board: it talks to the provider the user configured,
 * it can be told about the board, and it can put a diagram back on the
 * board. It has no model of its own and no key of its own - everything it
 * knows about the provider comes from the user's own settings.
 */

import clsx from "clsx";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useState } from "react";

import { t } from "../../i18n";
import { useApp, useExcalidrawElements } from "../App";

import { AIApiError, sendChatCompletion } from "./api";
import { AISettingsForm, draftFromSettings } from "./AISettingsForm";
import { type AISettingsDraft, emptyAISettingsDraft } from "./AISettingsForm";
import { closeAIPanel, useAIPanelOpen } from "./aiPanelStore";
import { insertAIElements } from "./diagramElements";
import { parseDiagramElements } from "./diagramParser";
import { aiIcon } from "./icons";
import {
  buildBoardSummary,
  buildChatMessages,
  buildDiagramMessages,
  buildSummaryMessages,
} from "./prompts";
import {
  clearAISettings,
  isAISettingsConfigured,
  loadAISettings,
  saveAISettings,
} from "./storage";

import "./AIAssistantPanel.scss";

import type { AIChatEntry, AIChatMessage, AISettings } from "./types";

/**
 * The assistant panel.
 */
export const AIAssistantPanel = () => {
  const app = useApp();
  const elements = useExcalidrawElements();
  const isOpen = useAIPanelOpen();

  const [settings, setSettings] = useState<AISettings | null>(() =>
    loadAISettings(),
  );
  const [draft, setDraft] = useState<AISettingsDraft>(() => {
    const stored = loadAISettings();
    return stored ? draftFromSettings(stored) : emptyAISettingsDraft();
  });
  const [isEditingSettings, setIsEditingSettings] = useState(false);
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIChatEntry[]>([]);
  const [includeBoardSummary, setIncludeBoardSummary] = useState(true);
  const [input, setInput] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** adds a line to the conversation */
  const appendEntry = useCallback((entry: Omit<AIChatEntry, "id">) => {
    setMessages((current) => [...current, { ...entry, id: nanoid() }]);
  }, []);

  /**
   * Asks the provider something.
   *
   * @returns the answer, or nothing when the request failed - the failure
   * is shown in the panel either way
   */
  const ask = useCallback(
    async (request: AIChatMessage[]): Promise<string | null> => {
      if (!settings) {
        return null;
      }

      setIsBusy(true);
      setError(null);

      try {
        return await sendChatCompletion({ settings, messages: request });
      } catch (err) {
        setError(
          err instanceof AIApiError ? err.message : t("labels.ai.genericError"),
        );
        return null;
      } finally {
        setIsBusy(false);
      }
    },
    [settings],
  );

  /** what was said before, as the provider wants to see it */
  const getHistory = useCallback((): AIChatMessage[] => {
    return messages
      .filter((entry) => !entry.isError)
      .map((entry) => ({ role: entry.role, content: entry.content }));
  }, [messages]);

  /** the board, as far as the model is concerned */
  const getBoardSummary = useCallback((): string => {
    if (!includeBoardSummary) {
      return "";
    }
    return buildBoardSummary(elements);
  }, [elements, includeBoardSummary]);

  /** asks the model about the board, in words */
  const handleSummarize = useCallback(async () => {
    const boardSummary = buildBoardSummary(elements);

    if (!boardSummary) {
      setError(t("labels.ai.emptyBoard"));
      return;
    }

    const answer = await ask(buildSummaryMessages({ boardSummary }));

    if (answer !== null) {
      appendEntry({ role: "assistant", content: answer });
    }
  }, [appendEntry, ask, elements]);

  /** asks the model to draw something, and puts it on the board */
  const handleGenerateDiagram = useCallback(async () => {
    const prompt = input.trim();

    if (!prompt) {
      setError(t("labels.ai.describeFirst"));
      return;
    }

    setInput("");

    const request = buildDiagramMessages({
      prompt,
      boardSummary: getBoardSummary(),
    });

    appendEntry({ role: "user", content: prompt });

    const answer = await ask(request);

    if (answer === null) {
      return;
    }

    const specs = parseDiagramElements(answer);

    if (!specs) {
      // the model did not answer with a diagram - show what it did say
      // rather than throwing it away
      appendEntry({ role: "assistant", content: answer, isError: true });
      setError(t("labels.ai.diagramFailed"));
      return;
    }

    const count = insertAIElements(app, specs);

    appendEntry({
      role: "assistant",
      content: t("labels.ai.addedElements", { count }),
      insertedElements: count,
    });
  }, [app, appendEntry, ask, getBoardSummary, input]);

  /** asks the model whatever the person typed */
  const handleSend = useCallback(async () => {
    const text = input.trim();

    if (!text) {
      return;
    }

    setInput("");

    const request = buildChatMessages({
      history: getHistory(),
      userText: text,
      boardSummary: getBoardSummary(),
    });

    appendEntry({ role: "user", content: text });

    const answer = await ask(request);

    if (answer !== null) {
      appendEntry({ role: "assistant", content: answer });
    }
  }, [appendEntry, ask, getBoardSummary, getHistory, input]);

  /** keeps what the user typed, so that it survives a failed save */
  const handleSave = useCallback(() => {
    const saved = saveAISettings(draft);

    if (!saved) {
      setSettingsStatus(t("labels.ai.savingFailed"));
      return;
    }

    setSettings(saved);
    setDraft(draftFromSettings(saved));
    setSettingsStatus(t("labels.ai.saved"));
    setIsEditingSettings(false);
  }, [draft]);

  /** tries the connection, so that a wrong url is found out now */
  const handleTest = useCallback(async () => {
    if (!isAISettingsConfigured(draft)) {
      setSettingsStatus(t("labels.ai.incomplete"));
      return;
    }

    setIsBusy(true);
    setSettingsStatus(t("labels.ai.testing"));

    try {
      await sendChatCompletion({
        settings: draft,
        messages: [{ role: "user", content: "ping" }],
      });
      setSettingsStatus(t("labels.ai.connectionOk"));
    } catch (err) {
      setSettingsStatus(
        err instanceof AIApiError ? err.message : t("labels.ai.genericError"),
      );
    } finally {
      setIsBusy(false);
    }
  }, [draft]);

  /** forgets the provider, the key and all */
  const handleClear = useCallback(() => {
    clearAISettings();
    setSettings(null);
    setDraft(emptyAISettingsDraft());
    setMessages([]);
    setSettingsStatus(t("labels.ai.cleared"));
    setIsEditingSettings(true);
  }, []);

  /** starts a new conversation, keeping the provider */
  const handleNewChat = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  const showSettings = !settings || isEditingSettings;

  return (
    <div className="ai-panel" data-testid="ai-panel">
      <div className="ai-panel__header">
        <span className="ai-panel__title">
          <span className="ai-panel__icon">{aiIcon}</span>
          {t("labels.ai.title")}
        </span>
        <div className="ai-panel__header-actions">
          {settings && !isEditingSettings && (
            <>
              <button
                type="button"
                className="ai-panel__header-button"
                data-testid="ai-new-chat"
                onClick={handleNewChat}
              >
                {t("labels.ai.newChat")}
              </button>
              <button
                type="button"
                className="ai-panel__header-button"
                data-testid="ai-open-settings"
                onClick={() => setIsEditingSettings(true)}
              >
                {t("labels.ai.settings")}
              </button>
            </>
          )}
          <button
            type="button"
            className="ai-panel__header-button ai-panel__header-button--close"
            data-testid="ai-close"
            aria-label={t("labels.ai.close")}
            onClick={closeAIPanel}
          >
            {"×"}
          </button>
        </div>
      </div>

      {showSettings ? (
        <AISettingsForm
          draft={draft}
          onChange={setDraft}
          onSave={handleSave}
          onTest={handleTest}
          onClear={handleClear}
          isBusy={isBusy}
          status={settingsStatus}
        />
      ) : (
        <>
          <div className="ai-panel__toolbar">
            <button
              type="button"
              className="ai-button"
              data-testid="ai-summarize"
              disabled={isBusy}
              onClick={handleSummarize}
            >
              {t("labels.ai.summarizeBoard")}
            </button>
            <button
              type="button"
              className="ai-button"
              data-testid="ai-generate"
              disabled={isBusy}
              onClick={handleGenerateDiagram}
            >
              {t("labels.ai.generateDiagram")}
            </button>
            <label
              className="ai-panel__toggle"
              title={t("labels.ai.includeBoardSummary")}
            >
              <input
                type="checkbox"
                checked={includeBoardSummary}
                data-testid="ai-include-board"
                onChange={(event) =>
                  setIncludeBoardSummary(event.target.checked)
                }
              />
              <span>{t("labels.ai.includeBoardSummary")}</span>
            </label>
          </div>

          <div className="ai-panel__messages" data-testid="ai-messages">
            {!messages.length && !isBusy && (
              <p className="ai-panel__empty">{t("labels.ai.emptyChat")}</p>
            )}
            {messages.map((entry) => (
              <div
                key={entry.id}
                className={clsx("ai-message", `ai-message--${entry.role}`, {
                  "ai-message--error": entry.isError,
                })}
                data-testid={
                  entry.role === "user"
                    ? "ai-message-user"
                    : "ai-message-assistant"
                }
              >
                {entry.content}
              </div>
            ))}
            {isBusy && (
              <div className="ai-message ai-message--assistant ai-message--pending">
                {t("labels.ai.thinking")}
              </div>
            )}
          </div>

          {error && (
            <div className="ai-panel__error" data-testid="ai-error">
              {error}
            </div>
          )}

          <div className="ai-panel__composer">
            <textarea
              className="ai-panel__input"
              value={input}
              rows={3}
              placeholder={t("labels.ai.placeholder")}
              data-testid="ai-input"
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className="ai-button ai-button--primary"
              data-testid="ai-send"
              disabled={isBusy}
              onClick={handleSend}
            >
              {t("labels.ai.send")}
            </button>
          </div>
        </>
      )}
    </div>
  );
};
