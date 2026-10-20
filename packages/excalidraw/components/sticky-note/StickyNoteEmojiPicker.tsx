import { useState } from "react";
import clsx from "clsx";

import { STICKY_NOTE_EMOJI } from "@excalidraw/common";

import { t } from "../../i18n";

/**
 * The emoji a note can be stamped with.
 *
 * A short, curated set rather than a full emoji keyboard: the picker is
 * there for a quick reaction, and the grid folds away so it does not take
 * over the styles panel.
 */
export const StickyNoteEmojiPicker = ({
  onSelect,
}: {
  onSelect: (emoji: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="sticky-note-emoji-picker">
      <button
        type="button"
        className={clsx("sticky-note-emoji-picker__toggle", {
          active: isOpen,
        })}
        title={t("labels.stickyNote.emoji")}
        aria-label={t("labels.stickyNote.emoji")}
        aria-expanded={isOpen}
        data-testid="sticky-note-emoji-toggle"
        onClick={() => setIsOpen((open) => !open)}
      >
        🙂
      </button>
      {isOpen && (
        <div
          className="sticky-note-emoji-picker__grid"
          data-testid="sticky-note-emoji-grid"
        >
          {STICKY_NOTE_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="sticky-note-emoji-picker__emoji"
              title={emoji}
              aria-label={emoji}
              data-testid={`sticky-note-emoji-${emoji}`}
              onClick={() => {
                onSelect(emoji);
                setIsOpen(false);
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
