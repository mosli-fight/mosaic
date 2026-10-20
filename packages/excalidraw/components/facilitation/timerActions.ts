/**
 * What can be done to the timer.
 *
 * The timer is session state, so every one of these writes to the
 * browser-side document rather than to the editor's state: a countdown
 * is not something one undoes.
 */

import { updateFacilitationStore } from "./storage";
import { createDefaultTimer, getTimerRemaining } from "./utils";

import type { FacilitationTimerState } from "./types";

const withTimer = (
  update: (timer: FacilitationTimerState) => FacilitationTimerState,
) =>
  updateFacilitationStore((store) => ({
    ...store,
    timer: store.timer ? update(store.timer) : update(createDefaultTimer()),
  }));

/** opens the timer widget, with the default duration */
export const showTimer = () =>
  updateFacilitationStore((store) => ({
    ...store,
    timer: store.timer ?? createDefaultTimer(),
  }));

/** closes the timer widget */
export const hideTimer = () =>
  updateFacilitationStore((store) => ({ ...store, timer: null }));

/**
 * Sets how long the countdown runs.
 *
 * Setting the duration of a running timer restarts it from the new
 * duration — the alternative (letting it run out on the old clock) is
 * never what the facilitator means.
 */
export const setTimerDuration = (durationMs: number) =>
  withTimer((timer) => ({
    ...timer,
    durationMs,
    remainingMs: durationMs,
    endsAt: null,
    status: "idle",
  }));

/** starts (or resumes) the countdown */
export const startTimer = () =>
  withTimer((timer) => {
    if (timer.status === "done") {
      // a finished timer starts over
      return {
        ...timer,
        remainingMs: timer.durationMs,
        endsAt: Date.now() + timer.durationMs,
        status: "running",
      };
    }

    const remaining = getTimerRemaining(timer);

    if (remaining <= 0) {
      return { ...timer, remainingMs: 0, endsAt: null, status: "idle" };
    }

    return {
      ...timer,
      remainingMs: remaining,
      endsAt: Date.now() + remaining,
      status: "running",
    };
  });

/** pauses the countdown, keeping what is left on the clock */
export const pauseTimer = () =>
  withTimer((timer) => {
    if (timer.status !== "running") {
      return timer;
    }
    return {
      ...timer,
      remainingMs: getTimerRemaining(timer),
      endsAt: null,
      status: "paused",
    };
  });

/** puts the timer back to the start of its duration */
export const resetTimer = () =>
  withTimer((timer) => ({
    ...timer,
    remainingMs: timer.durationMs,
    endsAt: null,
    status: "idle",
  }));

/** gives the countdown another minute */
export const addMinuteToTimer = () =>
  withTimer((timer) => {
    const remaining = getTimerRemaining(timer) + 60 * 1000;
    return {
      ...timer,
      durationMs: Math.max(timer.durationMs, remaining),
      remainingMs: remaining,
      endsAt: timer.status === "running" ? Date.now() + remaining : null,
      status: timer.status === "done" ? "running" : timer.status,
    };
  });

/** moves the widget somewhere else on the screen */
export const moveTimer = (position: { x: number; y: number } | null) =>
  withTimer((timer) => ({ ...timer, position }));
