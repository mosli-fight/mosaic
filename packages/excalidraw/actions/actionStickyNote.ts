import {
  DEFAULT_FONT_FAMILY,
  STICKY_NOTE_INK_FOR_BG,
  STICKY_NOTE_SIZE_PRESETS,
  VERTICAL_ALIGN,
  getLineHeight,
  type StickyNoteFontStyleFlag,
  type StickyNoteSizePreset,
  type StickyNoteTextAlignment,
} from "@excalidraw/common";

import {
  CaptureUpdateAction,
  getBaseFontSizeUpdate,
  getBoundTextElement,
  getSelectedElements,
  isStickyNoteBoundText,
  isStickyNoteElement,
  isTextElement,
  newElementWith,
  newTextElement,
  normalizeStickyNoteBackgroundColor,
  normalizeStickyNoteStrokeColor,
  normalizeStickyNoteTags,
  relayoutStickyNotes,
  syncStickyNoteInk,
} from "@excalidraw/element";

import type { ElementUpdate } from "@excalidraw/element/mutateElement";

import type {
  ElementsMap,
  ExcalidrawElement,
  ExcalidrawStickyNoteElement,
  ExcalidrawTextElement,
  FontStyle,
} from "@excalidraw/element/types";

import { register } from "./register";

import type { AppState } from "../types";

/**
 * The sticky note's own controls — the ones the generic styles panel does
 * not offer, because a note is not a shape: its fill, its size, the
 * typography of its label, its tags and the emoji that can be dropped into
 * it.
 *
 * Every action works on the *selected notes* and reaches their labels
 * through the binding, so a note and its label always end up consistent —
 * the label is what is drawn, the note is what holds it.
 */

const getSelectedStickyNotes = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): ExcalidrawStickyNoteElement[] => {
  const selected = getSelectedElements(elements, appState, {
    includeBoundTextElement: false,
  });
  return selected.filter(isStickyNoteElement);
};

type StickyNoteTargets = {
  notes: ExcalidrawStickyNoteElement[];
  elementsMap: ElementsMap;
  labelFor: (note: ExcalidrawStickyNoteElement) => ExcalidrawTextElement | null;
};

/**
 * The notes and their labels, as the actions see them. A note without a
 * live label (its text was deleted, or the file predates the label) is
 * still a note the user can fill — the emoji action gives it a label.
 */
const getStickyNoteTargets = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
): StickyNoteTargets => {
  const notes = getSelectedStickyNotes(elements, appState);
  const elementsMap = new Map(elements.map((el) => [el.id, el]));
  return {
    notes,
    elementsMap,
    labelFor: (note) => getBoundTextElement(note, elementsMap) ?? null,
  };
};

/**
 * How a note's label is born when the note does not have one yet (its text
 * was deleted, or the note was created and never typed into).
 */
type StickyNoteLabelInit = {
  text?: string;
  fontSize?: number;
  fontFamily?: number;
  textAlign?: StickyNoteTextAlignment;
  fontStyle?: FontStyle;
};

/**
 * Creates the label a note is missing, bound to it the same way a typed
 * label is: the note holds the reference, the label holds the text.
 */
const createStickyNoteLabel = (
  note: ExcalidrawStickyNoteElement,
  init: StickyNoteLabelInit,
  appState: AppState,
): ExcalidrawTextElement => {
  const fontFamily = init.fontFamily ?? appState.currentItemFontFamily;
  const fontSize = init.fontSize ?? appState.currentItemFontSize;
  return newTextElement({
    x: note.x,
    y: note.y,
    text: init.text ?? "",
    strokeColor: note.strokeColor,
    backgroundColor: note.backgroundColor,
    fillStyle: note.fillStyle,
    strokeWidth: note.strokeWidth,
    strokeStyle: note.strokeStyle,
    roughness: note.roughness,
    opacity: note.opacity,
    fontSize,
    baseFontSize: fontSize,
    fontFamily: fontFamily || DEFAULT_FONT_FAMILY,
    fontStyle: init.fontStyle,
    textAlign: init.textAlign ?? "center",
    verticalAlign: VERTICAL_ALIGN.MIDDLE,
    lineHeight: getLineHeight(fontFamily || DEFAULT_FONT_FAMILY),
    containerId: note.id,
    groupIds: note.groupIds,
    frameId: note.frameId,
    angle: note.angle,
  });
};

/**
 * Applies `update` to every selected note and `updateLabel` to every
 * selected note's label, then re-lays the notes out.
 *
 * The label update runs first, because the layout reads it: a note whose
 * label grew a font size is re-fitted around the new label, not the old one.
 *
 * A note without a label gets one when `createLabel` is given — the
 * typography controls then work on a note the user never typed into.
 */
const updateStickyNotes = (
  elements: readonly ExcalidrawElement[],
  appState: AppState,
  {
    update,
    updateLabel,
    createLabel,
  }: {
    update?: (
      note: ExcalidrawStickyNoteElement,
    ) => Partial<ExcalidrawStickyNoteElement> | null;
    updateLabel?: (
      label: ExcalidrawTextElement,
      note: ExcalidrawStickyNoteElement,
    ) => Partial<ExcalidrawTextElement> | null;
    createLabel?: (note: ExcalidrawStickyNoteElement) => StickyNoteLabelInit;
  },
): readonly ExcalidrawElement[] => {
  const { notes, elementsMap, labelFor } = getStickyNoteTargets(
    elements,
    appState,
  );
  if (!notes.length) {
    return elements;
  }
  const noteIds = new Set(notes.map((note) => note.id));

  // the notes that need a label, and the label each gets
  const createdLabels = new Map<
    ExcalidrawStickyNoteElement["id"],
    ExcalidrawTextElement
  >();
  if (createLabel) {
    for (const note of notes) {
      if (!labelFor(note)) {
        createdLabels.set(
          note.id,
          createStickyNoteLabel(note, createLabel(note), appState),
        );
      }
    }
  }

  const nextElements: ExcalidrawElement[] = [];
  for (const element of elements) {
    if (isStickyNoteElement(element) && noteIds.has(element.id)) {
      const patch = update?.(element);
      let next = patch ? newElementWith(element, patch) : element;
      const created = createdLabels.get(element.id);
      if (created) {
        next = newElementWith(next, {
          boundElements: (next.boundElements || []).concat({
            type: "text",
            id: created.id,
          }),
        });
      }
      nextElements.push(next);
      // the label sits right above its note in the paint order
      if (created) {
        nextElements.push(created);
      }
      continue;
    }
    if (isTextElement(element) && isStickyNoteBoundText(element, elementsMap)) {
      const note = elementsMap.get(element.containerId!);
      if (note && isStickyNoteElement(note) && noteIds.has(note.id)) {
        const patch = updateLabel?.(element, note);
        nextElements.push(patch ? newElementWith(element, patch) : element);
        continue;
      }
    }
    nextElements.push(element);
  }

  // a note's layout follows from its label, so the notes are re-fitted
  // around whatever the label update did
  return relayoutStickyNotes(nextElements, noteIds, {
    prevElementsMap: elementsMap,
  });
};

export const actionChangeStickyNoteFill = register<{ color: string }>({
  name: "changeStickyNoteFill",
  label: "labels.stickyNote.fill",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const color = value?.color;
    if (!color) {
      return false;
    }
    const backgroundColor = normalizeStickyNoteBackgroundColor(color);
    // the label is the note's ink, so a dark paper needs light ink —
    // otherwise the note is unreadable
    const ink = normalizeStickyNoteStrokeColor(
      STICKY_NOTE_INK_FOR_BG(backgroundColor),
    );

    const { notes } = getStickyNoteTargets(elements, appState);
    if (!notes.length) {
      // no note is selected — the pick configures the *next* note
      return {
        elements,
        appState: {
          ...appState,
          currentItemStickynoteBackgroundColor: backgroundColor,
          currentItemStickynoteStrokeColor: ink,
        },
        captureUpdate: CaptureUpdateAction.IMMEDIATELY,
      };
    }

    const nextElements = updateStickyNotes(elements, appState, {
      update: (note) => ({
        backgroundColor,
        strokeColor: ink,
      }),
    });

    return {
      elements: syncStickyNoteInk(
        nextElements,
        new Map(elements.map((el) => [el.id, el])),
      ),
      appState: {
        ...appState,
        currentItemStickynoteBackgroundColor: backgroundColor,
        currentItemStickynoteStrokeColor: ink,
      },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeStickyNoteSize = register<{
  preset: StickyNoteSizePreset;
}>({
  name: "changeStickyNoteSize",
  label: "labels.stickyNote.size",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const preset = value?.preset;
    const size = preset ? STICKY_NOTE_SIZE_PRESETS[preset] : null;
    if (!size) {
      return false;
    }
    const nextElements = updateStickyNotes(elements, appState, {
      update: (note) => ({
        width: size.width,
        height: size.height,
        baseHeight: size.height,
      }),
    });
    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeStickyNoteFontSize = register<{ fontSize: number }>({
  name: "changeStickyNoteFontSize",
  label: "labels.fontSize",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const fontSize = value?.fontSize;
    if (!fontSize) {
      return false;
    }
    const { elementsMap } = getStickyNoteTargets(elements, appState);
    const nextElements = updateStickyNotes(elements, appState, {
      updateLabel: (label) =>
        getBaseFontSizeUpdate(
          label,
          fontSize,
          elementsMap,
        ) as Partial<ExcalidrawTextElement>,
      createLabel: () => ({ fontSize }),
    });
    return {
      elements: nextElements,
      appState: { ...appState, currentItemFontSize: fontSize },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeStickyNoteFontFamily = register<{
  fontFamily: number;
}>({
  name: "changeStickyNoteFontFamily",
  label: "labels.fontFamily",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const fontFamily = value?.fontFamily;
    if (!fontFamily) {
      return false;
    }
    const nextElements = updateStickyNotes(elements, appState, {
      updateLabel: (label) => ({
        fontFamily,
        lineHeight: getLineHeight(fontFamily),
      }),
      createLabel: () => ({ fontFamily }),
    });
    return {
      elements: nextElements,
      appState: { ...appState, currentItemFontFamily: fontFamily },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionChangeStickyNoteTextAlign = register<{
  textAlign: StickyNoteTextAlignment;
}>({
  name: "changeStickyNoteTextAlign",
  label: "labels.textAlign",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const textAlign = value?.textAlign;
    if (!textAlign) {
      return false;
    }
    const nextElements = updateStickyNotes(elements, appState, {
      updateLabel: (label) => ({ textAlign }),
      createLabel: () => ({ textAlign }),
    });
    return {
      elements: nextElements,
      appState: { ...appState, currentItemTextAlign: textAlign },
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

/**
 * Bold and italic apply to the whole label — a note styles its label the
 * way it styles its fill, per note and not per word.
 *
 * The two are independent: a label can be bold *and* italic, and picking
 * the style a label already has turns that one off again.
 */
export const actionToggleStickyNoteFontStyle = register<{
  style: StickyNoteFontStyleFlag;
}>({
  name: "toggleStickyNoteFontStyle",
  label: "labels.stickyNote.fontStyle",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const style = value?.style;
    if (!style) {
      return false;
    }
    const nextElements = updateStickyNotes(elements, appState, {
      updateLabel: (label) => ({
        fontStyle: { ...label.fontStyle, [style]: !label.fontStyle?.[style] },
      }),
      createLabel: () => ({ fontStyle: { [style]: true } }),
    });
    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionAddStickyNoteTag = register<{ tag: string }>({
  name: "addStickyNoteTag",
  label: "labels.stickyNote.tags",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const tag = value?.tag?.trim();
    if (!tag) {
      return false;
    }
    const nextElements = updateStickyNotes(elements, appState, {
      update: (note) => ({
        tags: normalizeStickyNoteTags([...(note.tags ?? []), tag]),
      }),
    });
    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

export const actionRemoveStickyNoteTag = register<{ tag: string }>({
  name: "removeStickyNoteTag",
  label: "labels.stickyNote.tags",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const tag = value?.tag;
    if (!tag) {
      return false;
    }
    const nextElements = updateStickyNotes(elements, appState, {
      update: (note) => ({
        tags: (note.tags ?? []).filter((it) => it !== tag),
      }),
    });
    return {
      elements: nextElements,
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});

/**
 * Drops an emoji into the note's label.
 *
 * A note that has no label yet (its text was deleted) gets one — a label
 * with the emoji in it, bound to the note the same way a typed label is.
 */
export const actionInsertStickyNoteEmoji = register<{ emoji: string }>({
  name: "insertStickyNoteEmoji",
  label: "labels.stickyNote.emoji",
  trackEvent: false,
  perform: (elements, appState, value) => {
    const emoji = value?.emoji;
    if (!emoji) {
      return false;
    }
    const { notes, labelFor } = getStickyNoteTargets(elements, appState);
    if (!notes.length) {
      return false;
    }
    const noteIds = new Set(notes.map((note) => note.id));

    // the labels to rewrite, and the labels to create, keyed by the note
    // they belong to — the label keeps its place in the elements array, so
    // the note and its label stay one unit
    const labelPatches = new Map<
      ExcalidrawTextElement["id"],
      ElementUpdate<ExcalidrawTextElement>
    >();
    const createdLabels = new Map<
      ExcalidrawStickyNoteElement["id"],
      ExcalidrawTextElement
    >();

    for (const note of notes) {
      const label = labelFor(note);
      if (label) {
        // the label's `originalText` is the source the layout re-wraps
        labelPatches.set(label.id, {
          originalText: `${label.originalText ?? ""}${emoji}`,
          text: `${label.text}${emoji}`,
        });
      } else {
        createdLabels.set(
          note.id,
          createStickyNoteLabel(note, { text: emoji }, appState),
        );
      }
    }

    const nextElements: ExcalidrawElement[] = [];
    for (const element of elements) {
      if (isStickyNoteElement(element) && noteIds.has(element.id)) {
        const created = createdLabels.get(element.id);
        if (created) {
          nextElements.push(
            newElementWith(element, {
              boundElements: (element.boundElements || []).concat({
                type: "text",
                id: created.id,
              }),
            }),
          );
          nextElements.push(created);
        } else {
          nextElements.push(element);
        }
        continue;
      }
      if (isTextElement(element)) {
        const patch = labelPatches.get(element.id);
        if (patch) {
          nextElements.push(newElementWith(element, patch));
          continue;
        }
      }
      nextElements.push(element);
    }

    return {
      elements: relayoutStickyNotes(nextElements, noteIds),
      appState,
      captureUpdate: CaptureUpdateAction.IMMEDIATELY,
    };
  },
});
