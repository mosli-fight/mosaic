import { useEffect, useState } from "react";

import { t } from "../../i18n";

import { timerIcon } from "../icons";

import {
  hideTimer,
  pauseTimer,
  resetTimer,
  setTimerDuration,
  showTimer,
  startTimer,
} from "./timerActions";
import { useFacilitationStore } from "./useFacilitationStore";
import { formatDuration, TIMER_PRESETS_MS } from "./utils";

/**
 * The timer's half of the facilitation panel.
 *
 * It sets the countdown up; the widget that runs it floats over the
 * board.
 */
export const TimerSection = () => {
  const { timer } = useFacilitationStore();

  const [minutes, setMinutes] = useState("5");
  const [seconds, setSeconds] = useState("0");

  // the inputs follow the timer, unless the facilitator is typing in them
  useEffect(() => {
    if (!timer) {
      return;
    }
    const remaining = timer.durationMs;
    setMinutes(String(Math.floor(remaining / 60000)));
    setSeconds(String(Math.floor((remaining % 60000) / 1000)));
  }, [timer?.durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyDuration = () => {
    const total =
      (Number(minutes) || 0) * 60 * 1000 + (Number(seconds) || 0) * 1000;

    if (total > 0) {
      setTimerDuration(total);
    }
  };

  return (
    <section
      className="facilitation-panel__section"
      data-testid="facilitation-timer-section"
    >
      <h4 className="facilitation-panel__heading">
        {timerIcon}
        {t("facilitation.timer.title")}
      </h4>

      {!timer ? (
        <button
          type="button"
          className="facilitation-panel__button facilitation-panel__button--primary"
          onClick={() => showTimer()}
          data-testid="facilitation-timer-show"
        >
          {t("facilitation.timer.show")}
        </button>
      ) : (
        <>
          <div className="facilitation-panel__row">
            <label
              className="facilitation-panel__label"
              htmlFor="timer-minutes"
            >
              {t("facilitation.timer.minutes")}
            </label>
            <input
              id="timer-minutes"
              className="facilitation-panel__input facilitation-panel__input--number"
              type="number"
              min={0}
              max={599}
              value={minutes}
              data-testid="facilitation-timer-minutes"
              onChange={(event) => setMinutes(event.target.value)}
            />
            <label
              className="facilitation-panel__label"
              htmlFor="timer-seconds"
            >
              {t("facilitation.timer.seconds")}
            </label>
            <input
              id="timer-seconds"
              className="facilitation-panel__input facilitation-panel__input--number"
              type="number"
              min={0}
              max={59}
              value={seconds}
              data-testid="facilitation-timer-seconds"
              onChange={(event) => setSeconds(event.target.value)}
            />
            <button
              type="button"
              className="facilitation-panel__button"
              onClick={applyDuration}
              data-testid="facilitation-timer-apply"
            >
              {t("facilitation.timer.set")}
            </button>
          </div>

          <div className="facilitation-panel__presets">
            {TIMER_PRESETS_MS.map((preset) => (
              <button
                type="button"
                key={preset}
                className="facilitation-panel__preset"
                onClick={() => setTimerDuration(preset)}
                data-testid={`facilitation-timer-preset-${preset / 60000}`}
              >
                {preset / 60000}′
              </button>
            ))}
          </div>

          <div className="facilitation-panel__row">
            <button
              type="button"
              className="facilitation-panel__button facilitation-panel__button--primary"
              onClick={() =>
                timer.status === "running" ? pauseTimer() : startTimer()
              }
              data-testid="facilitation-timer-toggle"
            >
              {timer.status === "running"
                ? t("facilitation.timer.pause")
                : t("facilitation.timer.start")}
            </button>
            <button
              type="button"
              className="facilitation-panel__button"
              onClick={() => resetTimer()}
              data-testid="facilitation-timer-reset"
            >
              {t("facilitation.timer.reset")}
            </button>
            <button
              type="button"
              className="facilitation-panel__button"
              onClick={() => hideTimer()}
              data-testid="facilitation-timer-hide"
            >
              {t("facilitation.timer.hide")}
            </button>
          </div>

          <p className="facilitation-panel__hint">
            {t("facilitation.timer.remaining", {
              time: formatDuration(timer.remainingMs),
            })}
          </p>
        </>
      )}
    </section>
  );
};
