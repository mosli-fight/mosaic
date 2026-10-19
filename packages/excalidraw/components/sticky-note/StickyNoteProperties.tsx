import clsx from "clsx";
import { useState } from "react";

import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_FONT_SIZES,
  STICKY_NOTE_SIZE_PRESETS,
  STICKY_NOTE_SIZE_PRESET_NAMES,
  STICKY_NOTE_TEXT_ALIGNMENTS,
  type StickyNoteHueName,
  type StickyNoteSizePreset,
  type StickyNoteTextAlignment,
} from "@excalidraw/common";

import { getBoundTextElement, isStickyNoteElement } from "@excalidraw/element";

import type {
  NonDeletedElementsMap,
  NonDeletedSceneElementsMap,
} from "@excalidraw/element/types";

import {
  actionAddStickyNoteTag,
  actionChangeStickyNoteFill,
  actionChangeStickyNoteFontSize,
  actionChangeStickyNoteSize,
  actionChangeStickyNoteTextAlign,
  actionDeleteSelected,
  actionDuplicateSelection,
  actionInsertStickyNoteEmoji,
  actionRemoveStickyNoteTag,
  actionToggleElementLock,
  actionToggleStickyNoteFontStyle,
} from "../../actions";

import { t } from "../../i18n";
import { getTargetElements } from "../../scene";

import { useApp } from "../App";
import { RadioSelection } from "../RadioSelection";
import {
  DuplicateIcon,
  LockedIcon,
  TextAlignCenterIcon,
  TextAlignLeftIcon,
  TextAlignRightIcon,
  TrashIcon,
  UnlockedIcon,
} from "../icons";

import { StickyNoteEmojiPicker } from "./StickyNoteEmojiPicker";

import "./stickyNoteProperties.scss";

import type { TranslationKeys } from "../../i18n";
import type App from "../App";
import type { UIAppState } from "../../types";

/**
 * The translation keys of the panel's dynamic labels, spelled out so that
 * they stay type-checked against the locale file.
 */
const HUE_LABEL_KEYS: Record<StickyNoteHueName, TranslationKeys> = {
  yellow: "labels.stickyNote.hues.yellow",
  orange: "labels.stickyNote.hues.orange",
  red: "labels.stickyNote.hues.red",
  pink: "labels.stickyNote.hues.pink",
  violet: "labels.stickyNote.hues.violet",
  blue: "labels.stickyNote.hues.blue",
  cyan: "labels.stickyNote.hues.cyan",
  green: "labels.stickyNote.hues.green",
};

const SIZE_LABEL_KEYS: Record<StickyNoteSizePreset, TranslationKeys> = {
  small: "labels.stickyNote.sizeSmall",
  medium: "labels.stickyNote.sizeMedium",
  large: "labels.stickyNote.sizeLarge",
};

const ALIGN_LABEL_KEYS: Record<StickyNoteTextAlignment, TranslationKeys> = {
  left: "labels.stickyNote.alignLeft",
  center: "labels.stickyNote.alignCenter",
  right: "labels.stickyNote.alignRight",
};

const VARIANT_LABEL_KEYS: Record<"light" | "dark", TranslationKeys> = {
  light: "labels.stickyNote.light",
  dark: "labels.stickyNote.dark",
};

/** the size preset that matches a note's current width, if any */
const getActiveSizePreset = (width: number): StickyNoteSizePreset | null => {
  const match = STICKY_NOTE_SIZE_PRESET_NAMES.find(
    (preset) => Math.abs(STICKY_NOTE_SIZE_PRESETS[preset].width - width) < 1,
  );
  return match ?? null;
};

/**
 * The Miro-style controls of a sticky note: its paper color, its size, the
 * typography of its label, its tags and the emoji stamped on it.
 *
 * Shown in the styles panel whenever a note is selected. Every control runs
 * an action, so a note's fill, its label and its footer never drift apart.
 */
export const StickyNoteProperties = ({
  appState,
  elementsMap,
}: {
  appState: UIAppState;
  elementsMap: NonDeletedElementsMap | NonDeletedSceneElementsMap;
}) => {
  // the action manager lives on the app instance, not on the public
  // `AppClassProperties` surface the context is typed with
  const app = useApp() as App;
  const [tagDraft, setTagDraft] = useState("");

  const notes = getTargetElements(elementsMap, appState).filter(
    isStickyNoteElement,
  );
  const note = notes[0] ?? null;
  const label = note ? getBoundTextElement(note, elementsMap) ?? null : null;
  // with the sticky-note tool active and nothing selected, the panel
  // configures the *next* note rather than an existing one
  const isToolActive = appState.activeTool.type === "stickynote";

  if (!note && !isToolActive) {
    return null;
  }

  const currentFontSize =
    label?.baseFontSize ?? label?.fontSize ?? appState.currentItemFontSize;
  const isBold = !!label?.fontStyle?.bold;
  const isItalic = !!label?.fontStyle?.italic;
  const currentTextAlign = (label?.textAlign ??
    "center") as StickyNoteTextAlignment;
  const activePreset = note ? getActiveSizePreset(note.width) : null;
  const currentFill =
    note?.backgroundColor ?? appState.currentItemStickynoteBackgroundColor;
  const tags = note?.tags ?? [];
  const isLocked = note?.locked ?? false;

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed) {
      return;
    }
    app.actionManager.executeAction(actionAddStickyNoteTag, "ui", {
      tag: trimmed,
    });
    setTagDraft("");
  };

  return (
    <div className="sticky-note-properties">
      <fieldset>
        <legend>{t("labels.stickyNote.fill")}</legend>
        <div
          className="sticky-note-properties__swatches"
          data-testid="sticky-note-fill"
        >
          {STICKY_NOTE_COLORS.map(({ name, variant, value }) => {
            const label_ = `${t(HUE_LABEL_KEYS[name])} — ${t(
              VARIANT_LABEL_KEYS[variant],
            )}`;
            return (
              <button
                key={`${name}-${variant}`}
                type="button"
                className={clsx("sticky-note-properties__swatch", {
                  active: currentFill === value,
                })}
                style={{ backgroundColor: value }}
                title={label_}
                aria-label={label_}
                data-testid={`sticky-note-fill-${name}-${variant}`}
                onClick={() =>
                  app.actionManager.executeAction(
                    actionChangeStickyNoteFill,
                    "ui",
                    { color: value },
                  )
                }
              />
            );
          })}
        </div>
      </fieldset>

      {note && (
        <fieldset>
          <legend>{t("labels.stickyNote.size")}</legend>
          <div className="buttonList">
            <RadioSelection
              type="button"
              options={STICKY_NOTE_SIZE_PRESET_NAMES.map((preset) => ({
                value: preset,
                text: t(SIZE_LABEL_KEYS[preset]),
                icon: (
                  <span
                    className="sticky-note-properties__size-box"
                    data-size={preset}
                  />
                ),
                testId: `sticky-note-size-${preset}`,
                active: activePreset === preset,
              }))}
              value={null}
              onClick={(preset) =>
                app.actionManager.executeAction(
                  actionChangeStickyNoteSize,
                  "ui",
                  { preset },
                )
              }
            />
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>{t("labels.stickyNote.text")}</legend>
        <div className="buttonList">
          <RadioSelection
            type="button"
            options={STICKY_NOTE_FONT_SIZES.map((fontSize) => ({
              value: fontSize,
              text: `${fontSize}px`,
              icon: (
                <span className="sticky-note-properties__font-size">
                  {fontSize}
                </span>
              ),
              testId: `sticky-note-font-size-${fontSize}`,
              active: currentFontSize === fontSize,
            }))}
            value={null}
            onClick={(fontSize) =>
              app.actionManager.executeAction(
                actionChangeStickyNoteFontSize,
                "ui",
                { fontSize },
              )
            }
          />
        </div>
        {note && (
          <div className="buttonList">
            <RadioSelection
              type="button"
              options={STICKY_NOTE_TEXT_ALIGNMENTS.map((textAlign) => ({
                value: textAlign,
                text: t(ALIGN_LABEL_KEYS[textAlign]),
                icon:
                  textAlign === "left"
                    ? TextAlignLeftIcon
                    : textAlign === "center"
                    ? TextAlignCenterIcon
                    : TextAlignRightIcon,
                testId: `sticky-note-align-${textAlign}`,
                active: currentTextAlign === textAlign,
              }))}
              value={null}
              onClick={(textAlign) =>
                app.actionManager.executeAction(
                  actionChangeStickyNoteTextAlign,
                  "ui",
                  { textAlign },
                )
              }
            />
            <button
              type="button"
              className={clsx("sticky-note-properties__style", {
                active: isBold,
              })}
              title={t("labels.stickyNote.bold")}
              aria-label={t("labels.stickyNote.bold")}
              data-testid="sticky-note-bold"
              onClick={() =>
                app.actionManager.executeAction(
                  actionToggleStickyNoteFontStyle,
                  "ui",
                  { style: "bold" },
                )
              }
            >
              <strong>B</strong>
            </button>
            <button
              type="button"
              className={clsx("sticky-note-properties__style", {
                active: isItalic,
              })}
              title={t("labels.stickyNote.italic")}
              aria-label={t("labels.stickyNote.italic")}
              data-testid="sticky-note-italic"
              onClick={() =>
                app.actionManager.executeAction(
                  actionToggleStickyNoteFontStyle,
                  "ui",
                  { style: "italic" },
                )
              }
            >
              <em>I</em>
            </button>
          </div>
        )}
      </fieldset>

      {note && (
        <>
          <fieldset>
            <legend>{t("labels.stickyNote.emoji")}</legend>
            <StickyNoteEmojiPicker
              onSelect={(emoji) =>
                app.actionManager.executeAction(
                  actionInsertStickyNoteEmoji,
                  "ui",
                  { emoji },
                )
              }
            />
          </fieldset>

          <fieldset>
            <legend>{t("labels.stickyNote.tags")}</legend>
            {tags.length > 0 && (
              <div className="sticky-note-properties__tags">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="sticky-note-properties__tag"
                    data-testid={`sticky-note-tag-${tag}`}
                  >
                    <span className="sticky-note-properties__tag-label">
                      {tag}
                    </span>
                    <button
                      type="button"
                      className="sticky-note-properties__tag-remove"
                      title={t("labels.stickyNote.removeTag")}
                      aria-label={t("labels.stickyNote.removeTag")}
                      onClick={() =>
                        app.actionManager.executeAction(
                          actionRemoveStickyNoteTag,
                          "ui",
                          { tag },
                        )
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="sticky-note-properties__tag-input">
              <input
                type="text"
                value={tagDraft}
                placeholder={t("labels.stickyNote.tagPlaceholder")}
                aria-label={t("labels.stickyNote.addTag")}
                data-testid="sticky-note-tag-input"
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag(tagDraft);
                  }
                }}
              />
              <button
                type="button"
                disabled={!tagDraft.trim()}
                onClick={() => addTag(tagDraft)}
              >
                {t("labels.stickyNote.addTag")}
              </button>
            </div>
          </fieldset>

          {note.author && (
            <fieldset>
              <legend>{t("labels.stickyNote.author")}</legend>
              <div
                className="sticky-note-properties__author"
                data-testid="sticky-note-author"
              >
                {note.author}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend>{t("labels.actions")}</legend>
            <div className="buttonList">
              <button
                type="button"
                className="sticky-note-properties__action"
                title={t("labels.stickyNote.duplicate")}
                aria-label={t("labels.stickyNote.duplicate")}
                data-testid="sticky-note-duplicate"
                onClick={() =>
                  app.actionManager.executeAction(
                    actionDuplicateSelection,
                    "ui",
                  )
                }
              >
                {DuplicateIcon}
              </button>
              <button
                type="button"
                className="sticky-note-properties__action"
                title={
                  isLocked
                    ? t("labels.stickyNote.unlock")
                    : t("labels.stickyNote.lock")
                }
                aria-label={
                  isLocked
                    ? t("labels.stickyNote.unlock")
                    : t("labels.stickyNote.lock")
                }
                data-testid="sticky-note-lock"
                onClick={() =>
                  app.actionManager.executeAction(actionToggleElementLock, "ui")
                }
              >
                {isLocked ? LockedIcon : UnlockedIcon}
              </button>
              <button
                type="button"
                className="sticky-note-properties__action"
                title={t("labels.stickyNote.delete")}
                aria-label={t("labels.stickyNote.delete")}
                data-testid="sticky-note-delete"
                onClick={() =>
                  app.actionManager.executeAction(actionDeleteSelected, "ui")
                }
              >
                {TrashIcon}
              </button>
            </div>
          </fieldset>
        </>
      )}
    </div>
  );
};
