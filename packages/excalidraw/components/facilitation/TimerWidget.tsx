import clsx from "clsx";
import { useCallback, useEffect, useRef, useState } from "react";

import { t } from "../../i18n";

import { useExcalidrawContainer } from "../App";

import { timerPauseIcon, timerResetIcon, timerStartIcon } from "../icons";

import {
  addMinuteToTimer,
  hideTimer,
  moveTimer,
  pauseTimer,
  resetTimer,
  startTimer,
} from "./timerActions";
import { updateFacilitationStore } from "./storage";
import { useFacilitationStore } from "./useFacilitationStore";
import { formatDuration, getTimerProgress, getTimerRemaining } from "./utils";

import "./facilitation.scss";

/** how often the clock looks at the wall clock */
const TICK_MS = 200;

/** the size of the countdown ring, in pixels */
const RING_SIZE = 72;

/** the ring's stroke width */
const RING_STROKE = 6;

/**
 * The countdown widget.
 *
 * It floats over the board (in the corner, until it is dragged somewhere
 * else) and it is deliberately *silent*: a workshop timer that beeps in
 * a video call is a nuisance, so the widget flashes instead.
 */
export const TimerWidget = () => {
  const { container } = useExcalidrawContainer();
  const { timer } = useFacilitationStore();

  // the clock is read from the wall clock, so the widget keeps counting
  // while the tab is in the background
  const [now, setNow] = useState(() => Date.now());

  const dragState = useRef<{
    pointerId: number;
    offsetX: number;
    offsetY: number;
  } | null>(null);

  const isRunning = timer?.status === "running";

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const interval = setInterval(() => setNow(Date.now()), TICK_MS);

    return () => clearInterval(interval);
  }, [isRunning]);

  // the countdown is over: the widget says so
  useEffect(() => {
    if (timer && isRunning && getTimerRemaining(timer, now) <= 0) {
      updateFacilitationStore((store) => ({
        ...store,
        timer: store.timer
          ? { ...store.timer, status: "done", endsAt: null, remainingMs: 0 }
          : null,
      }));
    }
  }, [timer, isRunning, now]);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!container || !timer) {
        return;
      }

      const rect = container.getBoundingClientRect();
      const widget = event.currentTarget.parentElement?.getBoundingClientRect();

      dragState.current = {
        pointerId: event.pointerId,
        offsetX: event.clientX - (widget?.left ?? rect.left),
        offsetY: event.clientY - (widget?.top ?? rect.top),
      };

      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    [container, timer],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;

      if (!drag || !container || drag.pointerId !== event.pointerId) {
        return;
      }

      const rect = container.getBoundingClientRect();

      moveTimer({
        x: Math.max(0, event.clientX - rect.left - drag.offsetX),
        y: Math.max(0, event.clientY - rect.top - drag.offsetY),
      });
    },
    [container],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (dragState.current?.pointerId === event.pointerId) {
        dragState.current = null;
      }
    },
    [],
  );

  if (!timer) {
    return null;
  }

  const remaining = getTimerRemaining(timer, now);
  const progress = getTimerProgress(timer, now);
  const isDone = timer.status === "done";

  const radius = (RING_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={clsx("facilitation-timer", {
        "facilitation-timer--done": isDone,
        "facilitation-timer--running": isRunning,
        "facilitation-timer--dragged": !!timer.position,
      })}
      style={
        timer.position
          ? { left: timer.position.x, top: timer.position.y }
          : undefined
      }
      data-testid="facilitation-timer"
    >
      <div
        className="facilitation-timer__handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        data-testid="facilitation-timer-handle"
        title={t("facilitation.timer.drag")}
      >
        <span className="facilitation-timer__title">
          {isDone
            ? t("facilitation.timer.timeUp")
            : t("facilitation.timer.title")}
        </span>
        <button
          type="button"
          className="facilitation-timer__close"
          title={t("facilitation.timer.hide")}
          aria-label={t("facilitation.timer.hide")}
          data-testid="facilitation-timer-close"
          onClick={() => hideTimer()}
        >
          ✕
        </button>
      </div>

      <div className="facilitation-timer__body">
        <svg
          className="facilitation-timer__ring"
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden="true"
        >
          <circle
            className="facilitation-timer__ring-track"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
          />
          <circle
            className="facilitation-timer__ring-progress"
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            fill="none"
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - progress)}
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </svg>

        <div
          className="facilitation-timer__time"
          data-testid="facilitation-timer-time"
          role="timer"
          aria-live="off"
        >
          {isDone
            ? t("facilitation.timer.timeUpShort")
            : formatDuration(remaining)}
        </div>
      </div>

      <div className="facilitation-timer__controls">
        <button
          type="button"
          className="facilitation-timer__button"
          title={
            isRunning
              ? t("facilitation.timer.pause")
              : t("facilitation.timer.start")
          }
          aria-label={
            isRunning
              ? t("facilitation.timer.pause")
              : t("facilitation.timer.start")
          }
          data-testid="facilitation-timer-toggle"
          onClick={() => (isRunning ? pauseTimer() : startTimer())}
        >
          {isRunning ? timerPauseIcon : timerStartIcon}
        </button>
        <button
          type="button"
          className="facilitation-timer__button"
          title={t("facilitation.timer.addMinute")}
          aria-label={t("facilitation.timer.addMinute")}
          data-testid="facilitation-timer-add-minute"
          onClick={() => addMinuteToTimer()}
        >
          +1
        </button>
        <button
          type="button"
          className="facilitation-timer__button"
          title={t("facilitation.timer.reset")}
          aria-label={t("facilitation.timer.reset")}
          data-testid="facilitation-timer-reset"
          onClick={() => resetTimer()}
        >
          {timerResetIcon}
        </button>
      </div>
    </div>
  );
};
