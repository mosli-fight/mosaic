import { CODES, KEYS } from "@excalidraw/common";

import {
  CaptureUpdateAction,
  getFrameLikeTitle,
  isFrameLikeElement,
  moveFrameInFramesOrder,
  newElementWith,
} from "@excalidraw/element";

import type {
  ExcalidrawElement,
  ExcalidrawFrameLikeElement,
  NonDeleted,
} from "@excalidraw/element/types";

import { getFrameViewport, getPresentableFrames } from "../frames";
import { t } from "../i18n";

import { register } from "./register";

import type { AppClassProperties, AppState, UIAppState } from "../types";

/**
 * The frame's own controls — the ones the generic styles panel does not
 * offer, because a frame is not a shape: it is a canvas with a fill, a
 * name, a presenter note, and a life of its own on the board (hidden or
 * not).
 *
 * Every action works on the *selected frames*, and a frame is selected
 * alone — a frame is the unit the user thinks in.
 */

const getSelectedFrames = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): ExcalidrawFrameLikeElement[] => {
  const selected = new Set(Object.keys(appState.selectedElementIds));

  return elements.filter(
    (element): element is ExcalidrawFrameLikeElement =>
      isFrameLikeElement(element) && selected.has(element.id),
  );
};

/**
 * Maps the selected frames to their updated selves, leaving everything else
 * alone.
 */
const updateSelectedFrames = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  update: (
    frame: ExcalidrawFrameLikeElement,
  ) => Partial<ExcalidrawFrameLikeElement>,
): readonly ExcalidrawElement[] => {
  const selected = new Set(Object.keys(appState.selectedElementIds));

  return elements.map((element) =>
    isFrameLikeElement(element) && selected.has(element.id)
      ? newElementWith(element, update(element))
      : element,
  );
};

export const actionChangeFrameFill = register<{ color: string }>({
  name: "changeFrameFill",
  label: "labels.frame.fill",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    getSelectedFrames(elements, appState).length > 0,
  perform: (elements, appState, value) => {
    const color = value?.color;
    if (!color) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      elements: updateSelectedFrames(elements, appState, () => ({
        backgroundColor: color,
      })),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionToggleFrameHidden = register({
  name: "toggleFrameHidden",
  label: "labels.frame.hide",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    getSelectedFrames(elements, appState).length > 0,
  perform: (elements, appState) => {
    const frames = getSelectedFrames(elements, appState);
    if (!frames.length) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    // hiding a frame hides what is on it, so the selection of the frame's
    // contents is dropped along with the frame itself
    const hidden = !frames[0].hidden;

    return {
      elements: updateSelectedFrames(elements, appState, () => ({
        hidden,
      })),
      appState: {
        ...appState,
        selectedElementIds: {},
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionRenameFrame = register<{ name: string }>({
  name: "renameFrame",
  label: "labels.frame.rename",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    getSelectedFrames(elements, appState).length > 0,
  perform: (elements, appState, value) => {
    const name = value?.name?.trim() || null;

    return {
      elements: updateSelectedFrames(elements, appState, () => ({ name })),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionSetFrameNotes = register<{ notes: string }>({
  name: "setFrameNotes",
  label: "labels.frame.notes",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    getSelectedFrames(elements, appState).length > 0,
  perform: (elements, appState, value) => {
    const notes = value?.notes ?? "";

    return {
      elements: updateSelectedFrames(elements, appState, () => ({ notes })),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionMoveFrameUp = register({
  name: "moveFrameUp",
  label: "labels.frame.moveUp",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    getSelectedFrames(elements, appState).length === 1,
  perform: (elements, appState) => {
    const [frame] = getSelectedFrames(elements, appState);
    if (!frame) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      elements: moveFrameInFramesOrder(elements, frame.id, "up"),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionMoveFrameDown = register({
  name: "moveFrameDown",
  label: "labels.frame.moveDown",
  trackEvent: { category: "element" },
  predicate: (elements, appState) =>
    getSelectedFrames(elements, appState).length === 1,
  perform: (elements, appState) => {
    const [frame] = getSelectedFrames(elements, appState);
    if (!frame) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    return {
      elements: moveFrameInFramesOrder(elements, frame.id, "down"),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

// --------------------------- Present mode ----------------------------------

/**
 * The frame a presentation starts on: the one the user is looking at, or
 * the first one on the board.
 */
const getFrameToStartFrom = (
  frames: readonly ExcalidrawFrameLikeElement[],
  appState: AppState,
): ExcalidrawFrameLikeElement | null => {
  const selected = Object.keys(appState.selectedElementIds);

  const selectedFrame = frames.find((frame) => selected.includes(frame.id));
  if (selectedFrame) {
    return selectedFrame;
  }

  return frames[0] ?? null;
};

/**
 * The viewport that shows the given frame filling the screen.
 */
const getViewportForFrame = (
  frame: ExcalidrawFrameLikeElement,
  appState: AppState,
  app: AppClassProperties,
) => {
  return getFrameViewport({
    frame,
    appState,
    elementsMap: app.scene.getNonDeletedElementsMap(),
    // the editor chrome is off-stage in present mode, so the frame is
    // fitted to the whole viewport rather than to the space the chrome
    // leaves behind
    canvasOffsets: { top: 0, right: 0, bottom: 0, left: 0 },
  });
};

export const actionTogglePresentMode = register({
  name: "togglePresentMode",
  label: "labels.present.start",
  keywords: ["present", "presentation", "slideshow", "slides"],
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) =>
    getPresentableFrames(elements).length > 0 || appState.presentMode.active,
  perform: (elements, appState, _, app) => {
    if (appState.presentMode.active) {
      const { previousViewport } = appState.presentMode;

      return {
        elements,
        appState: {
          ...appState,
          ...(previousViewport
            ? {
                scrollX: previousViewport.scrollX,
                scrollY: previousViewport.scrollY,
                zoom: previousViewport.zoom,
              }
            : null),
          presentMode: {
            active: false,
            currentFrameId: null,
            previousViewport: null,
          },
        },
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const frames = getPresentableFrames(elements);
    const frame = getFrameToStartFrom(frames, appState);
    if (!frame) {
      return {
        elements,
        appState,
        captureUpdate: CaptureUpdateAction.EVENTUALLY,
      };
    }

    const viewport = getViewportForFrame(frame, appState, app);

    return {
      elements,
      appState: {
        ...appState,
        ...viewport,
        presentMode: {
          active: true,
          currentFrameId: frame.id,
          previousViewport: {
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
          },
        },
      },
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  },
  checked: (appState: Readonly<UIAppState>) => appState.presentMode.active,
  keyTest: (event) =>
    !event[KEYS.CTRL_OR_CMD] && event.altKey && event.code === CODES.P,
});

/**
 * Steps through the frames of a presentation.
 *
 * The step wraps around: a presentation that stops at the last frame is a
 * presentation that has to be dismissed to leave.
 */
const stepFrame = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  app: AppClassProperties,
  direction: 1 | -1,
) => {
  const frames = getPresentableFrames(elements);
  if (!frames.length) {
    return {
      elements,
      appState,
      captureUpdate: CaptureUpdateAction.EVENTUALLY,
    };
  }

  const currentIndex = frames.findIndex(
    (frame) => frame.id === appState.presentMode.currentFrameId,
  );

  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + direction + frames.length) % frames.length;

  const frame = frames[nextIndex];
  const viewport = getViewportForFrame(frame, appState, app);

  return {
    elements,
    appState: {
      ...appState,
      ...viewport,
      presentMode: {
        ...appState.presentMode,
        active: true,
        currentFrameId: frame.id,
      },
    },
    captureUpdate: CaptureUpdateAction.EVENTUALLY,
  };
};

export const actionPresentNextFrame = register({
  name: "presentNextFrame",
  label: "labels.present.next",
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) => appState.presentMode.active,
  perform: (elements, appState, _, app) =>
    stepFrame(elements, appState, app, 1),
});

export const actionPresentPreviousFrame = register({
  name: "presentPreviousFrame",
  label: "labels.present.previous",
  trackEvent: { category: "canvas" },
  predicate: (elements, appState) => appState.presentMode.active,
  perform: (elements, appState, _, app) =>
    stepFrame(elements, appState, app, -1),
});

/**
 * The title of the frame being presented, for the presenter's chrome.
 */
export const getPresentedFrameTitle = (
  frame: NonDeleted<ExcalidrawFrameLikeElement> | null,
) => (frame ? getFrameLikeTitle(frame) : t("labels.present.noFrames"));
