/**
 * The form where the user says which provider they want to talk to.
 *
 * There is no built-in AI and no bundled key: the user brings their own
 * endpoint, their own key and their own model, and the form is where they
 * say so. The key is a password field, it is kept in this browser, and it
 * is sent only to the url the user set.
 */

import { useState } from "react";

import { t } from "../../i18n";

import type { AISettings } from "./types";

/** the form's own idea of what the user typed */
export type AISettingsDraft = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

/** the empty form */
export const emptyAISettingsDraft = (): AISettingsDraft => ({
  baseUrl: "",
  apiKey: "",
  model: "",
});

/** the form, filled in with what is already known */
export const draftFromSettings = (settings: AISettings): AISettingsDraft => ({
  baseUrl: settings.baseUrl,
  apiKey: settings.apiKey,
  model: settings.model,
});

/**
 * The setup form.
 *
 * @param draft what the user has typed so far
 * @param onChange called with the whole draft whenever a field changes
 * @param onSave called when the user asks for the settings to be kept
 * @param onTest called when the user asks for the connection to be tried
 * @param onClear called when the user asks for the settings to be forgotten
 * @param isBusy whether a connection test is running
 * @param status the outcome of the last save or test
 */
export const AISettingsForm = ({
  draft,
  onChange,
  onSave,
  onTest,
  onClear,
  isBusy,
  status,
}: {
  draft: AISettingsDraft;
  onChange: (draft: AISettingsDraft) => void;
  onSave: () => void;
  onTest: () => void;
  onClear: () => void;
  isBusy: boolean;
  status: string | null;
}) => {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="ai-settings" data-testid="ai-settings-form">
      <p className="ai-settings__note">{t("labels.ai.privacyNote")}</p>

      <label className="ai-settings__field">
        <span className="ai-settings__label">{t("labels.ai.baseUrl")}</span>
        <input
          className="ai-settings__input"
          type="url"
          value={draft.baseUrl}
          placeholder={t("labels.ai.baseUrlPlaceholder")}
          data-testid="ai-base-url"
          onChange={(event) =>
            onChange({ ...draft, baseUrl: event.target.value })
          }
        />
      </label>

      <label className="ai-settings__field">
        <span className="ai-settings__label">{t("labels.ai.apiKey")}</span>
        <div className="ai-settings__input-row">
          <input
            className="ai-settings__input"
            type={showKey ? "text" : "password"}
            value={draft.apiKey}
            placeholder={t("labels.ai.apiKeyPlaceholder")}
            data-testid="ai-api-key"
            autoComplete="off"
            spellCheck={false}
            onChange={(event) =>
              onChange({ ...draft, apiKey: event.target.value })
            }
          />
          <button
            type="button"
            className="ai-settings__reveal"
            data-testid="ai-toggle-key"
            onClick={() => setShowKey((shown) => !shown)}
          >
            {showKey ? t("labels.ai.hideKey") : t("labels.ai.showKey")}
          </button>
        </div>
      </label>

      <label className="ai-settings__field">
        <span className="ai-settings__label">{t("labels.ai.model")}</span>
        <input
          className="ai-settings__input"
          type="text"
          value={draft.model}
          placeholder={t("labels.ai.modelPlaceholder")}
          data-testid="ai-model"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) =>
            onChange({ ...draft, model: event.target.value })
          }
        />
      </label>

      <div className="ai-settings__actions">
        <button
          type="button"
          className="ai-button ai-button--primary"
          data-testid="ai-save"
          onClick={onSave}
        >
          {t("labels.ai.save")}
        </button>
        <button
          type="button"
          className="ai-button"
          data-testid="ai-test"
          disabled={isBusy}
          onClick={onTest}
        >
          {t("labels.ai.testConnection")}
        </button>
        <button
          type="button"
          className="ai-button"
          data-testid="ai-clear"
          onClick={onClear}
        >
          {t("labels.ai.clear")}
        </button>
      </div>

      {status && (
        <p className="ai-settings__status" data-testid="ai-settings-status">
          {status}
        </p>
      )}
    </div>
  );
};
