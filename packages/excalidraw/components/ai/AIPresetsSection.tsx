/**
 * The presets section of the assistant panel.
 *
 * A preset is a named block of rules the user wants every answer to follow.
 * The section lets them pick one to apply, write a new one from the rules
 * they have just typed, rename one, or delete one. Nothing here talks to a
 * provider: the rules are saved in this browser and only become part of a
 * request through the system prompt.
 */

import { useState } from "react";

import { t } from "../../i18n";

import {
  createPreset,
  deletePreset,
  renamePreset,
  setActivePreset,
} from "./presets";

import type { AIPreset, AIPresetsState } from "./types";

/**
 * The presets section.
 *
 * @param state the saved presets and the applied one
 * @param onChange called with the whole state whenever it changes
 * @param status the outcome of the last save, when there was one
 */
export const AIPresetsSection = ({
  state,
  onChange,
  status,
}: {
  state: AIPresetsState;
  onChange: (state: AIPresetsState) => void;
  status: string | null;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRules, setNewRules] = useState("");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const activePreset =
    state.presets.find((preset) => preset.id === state.activeId) ?? null;

  /** finishes a rename, if the new name is worth keeping */
  const commitRename = (preset: AIPreset) => {
    onChange(renamePreset(state, preset.id, renameValue));
    setRenamingId(null);
  };

  return (
    <div className="ai-presets" data-testid="ai-presets">
      <button
        type="button"
        className="ai-presets__toggle"
        data-testid="ai-presets-toggle"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="ai-presets__toggle-label">
          {t("labels.ai.presets")}
          {activePreset && (
            <span className="ai-presets__active" data-testid="ai-preset-active">
              {activePreset.name}
            </span>
          )}
        </span>
        <span className="ai-presets__chevron" aria-hidden="true">
          {isOpen ? "▾" : "▸"}
        </span>
      </button>

      {isOpen && (
        <div className="ai-presets__body">
          <label className="ai-presets__field">
            <span className="ai-presets__label">
              {t("labels.ai.applyPreset")}
            </span>
            <select
              className="ai-presets__select"
              data-testid="ai-preset-select"
              value={state.activeId ?? ""}
              onChange={(event) =>
                onChange(setActivePreset(state, event.target.value || null))
              }
            >
              <option value="">{t("labels.ai.noPreset")}</option>
              {state.presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>

          {state.presets.length > 0 && (
            <ul className="ai-presets__list">
              {state.presets.map((preset) => (
                <li
                  key={preset.id}
                  className="ai-presets__item"
                  data-testid="ai-preset-item"
                >
                  {renamingId === preset.id ? (
                    <div className="ai-presets__rename">
                      <input
                        className="ai-presets__input"
                        type="text"
                        value={renameValue}
                        data-testid="ai-preset-rename-input"
                        autoFocus
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            commitRename(preset);
                          }
                          if (event.key === "Escape") {
                            setRenamingId(null);
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="ai-presets__small-button"
                        data-testid="ai-preset-rename-save"
                        onClick={() => commitRename(preset)}
                      >
                        {t("labels.ai.save")}
                      </button>
                    </div>
                  ) : (
                    <>
                      <span className="ai-presets__name" title={preset.rules}>
                        {preset.name}
                      </span>
                      <span className="ai-presets__item-actions">
                        <button
                          type="button"
                          className="ai-presets__small-button"
                          data-testid="ai-preset-rename"
                          onClick={() => {
                            setRenamingId(preset.id);
                            setRenameValue(preset.name);
                          }}
                        >
                          {t("labels.ai.rename")}
                        </button>
                        <button
                          type="button"
                          className="ai-presets__small-button"
                          data-testid="ai-preset-delete"
                          onClick={() =>
                            onChange(deletePreset(state, preset.id))
                          }
                        >
                          {t("labels.ai.delete")}
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="ai-presets__new">
            <input
              className="ai-presets__input"
              type="text"
              value={newName}
              placeholder={t("labels.ai.presetNamePlaceholder")}
              data-testid="ai-preset-name"
              onChange={(event) => setNewName(event.target.value)}
            />
            <textarea
              className="ai-presets__input ai-presets__rules"
              rows={2}
              value={newRules}
              placeholder={t("labels.ai.presetRulesPlaceholder")}
              data-testid="ai-preset-rules"
              onChange={(event) => setNewRules(event.target.value)}
            />
            <button
              type="button"
              className="ai-button"
              data-testid="ai-preset-create"
              disabled={!newName.trim() || !newRules.trim()}
              onClick={() => {
                const created = createPreset(state, newName, newRules);
                if (!created) {
                  return;
                }
                onChange(created.state);
                setNewName("");
                setNewRules("");
              }}
            >
              {t("labels.ai.createPreset")}
            </button>
          </div>

          {status && (
            <p className="ai-presets__status" data-testid="ai-preset-status">
              {status}
            </p>
          )}
        </div>
      )}
    </div>
  );
};
