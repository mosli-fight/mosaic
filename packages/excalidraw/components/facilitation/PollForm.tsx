import clsx from "clsx";
import { useState } from "react";

import { t } from "../../i18n";

import { MAX_POLL_OPTIONS, MIN_POLL_OPTIONS } from "./types";

import "./facilitation.scss";

import type { PollData } from "./types";

/**
 * The poll form: the question, and the options the room can pick.
 *
 * The same form creates a poll and edits one — a poll is created with a
 * question and two options, and both can be changed later.
 */
export const PollForm = ({
  poll,
  onSubmit,
  onCancel,
}: {
  /** the poll being edited; `null` when a new one is being created */
  poll?: PollData | null;
  onSubmit: (question: string, options: string[]) => void;
  onCancel: () => void;
}) => {
  const [question, setQuestion] = useState(poll?.question ?? "");
  const [options, setOptions] = useState<string[]>(
    poll?.options.map((option) => option.text) ?? ["", ""],
  );

  const isEditing = !!poll;

  const setOption = (index: number, value: string) => {
    setOptions((options) =>
      options.map((option, i) => (i === index ? value : option)),
    );
  };

  const addOption = () => {
    setOptions((options) =>
      options.length < MAX_POLL_OPTIONS ? [...options, ""] : options,
    );
  };

  const removeOption = (index: number) => {
    setOptions((options) =>
      options.length > MIN_POLL_OPTIONS
        ? options.filter((_, i) => i !== index)
        : options,
    );
  };

  const filledOptions = options.filter((option) => option.trim());
  const canSubmit =
    question.trim().length > 0 && filledOptions.length >= MIN_POLL_OPTIONS;

  return (
    <div
      className="facilitation-poll-form"
      data-testid="poll-form"
      onKeyDown={(event) => {
        // the form is a dialog of its own: the keys of the canvas must
        // not reach the editor while it is open
        event.stopPropagation();
      }}
    >
      <label className="facilitation-panel__label" htmlFor="poll-question">
        {t("facilitation.poll.question")}
      </label>
      <input
        id="poll-question"
        className="facilitation-panel__input"
        type="text"
        value={question}
        placeholder={t("facilitation.poll.questionPlaceholder")}
        autoFocus
        data-testid="poll-question-input"
        onChange={(event) => setQuestion(event.target.value)}
      />

      <div className="facilitation-panel__label">
        {t("facilitation.poll.options")}
      </div>

      <div className="facilitation-poll-form__options">
        {options.map((option, index) => (
          <div className="facilitation-poll-form__option" key={index}>
            <input
              className="facilitation-panel__input"
              type="text"
              value={option}
              placeholder={t("facilitation.poll.optionPlaceholder", {
                index: index + 1,
              })}
              aria-label={t("facilitation.poll.optionPlaceholder", {
                index: index + 1,
              })}
              data-testid={`poll-option-input-${index}`}
              onChange={(event) => setOption(index, event.target.value)}
            />
            <button
              type="button"
              className={clsx("facilitation-poll-form__remove", {
                "facilitation-poll-form__remove--disabled":
                  options.length <= MIN_POLL_OPTIONS,
              })}
              title={t("facilitation.poll.removeOption")}
              aria-label={t("facilitation.poll.removeOption")}
              disabled={options.length <= MIN_POLL_OPTIONS}
              data-testid={`poll-option-remove-${index}`}
              onClick={() => removeOption(index)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="facilitation-panel__link"
        disabled={options.length >= MAX_POLL_OPTIONS}
        onClick={addOption}
        data-testid="poll-add-option"
      >
        {t("facilitation.poll.addOption")}
      </button>

      <div className="facilitation-poll-form__actions">
        <button
          type="button"
          className="facilitation-panel__button"
          onClick={onCancel}
          data-testid="poll-form-cancel"
        >
          {t("facilitation.poll.cancel")}
        </button>
        <button
          type="button"
          className="facilitation-panel__button facilitation-panel__button--primary"
          disabled={!canSubmit}
          data-testid="poll-form-submit"
          onClick={() => onSubmit(question.trim(), filledOptions)}
        >
          {isEditing
            ? t("facilitation.poll.save")
            : t("facilitation.poll.create")}
        </button>
      </div>
    </div>
  );
};
