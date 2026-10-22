import { useMemo, useState } from "react";

import { t } from "../i18n";

import { searchEmojis } from "../components/media/emojiData";

import { COMMENT_EMOJI } from "./commentEmoji";

/**
 * The picker a reaction is chosen from.
 *
 * The quick row is the handful of emoji a reaction is usually made with, so
 * the common case is a single click. The search reaches into the same
 * catalogue the media panel offers, which is the whole emoji set the editor
 * knows about.
 *
 * This lives in a module of its own because it carries the emoji catalogue
 * with it: the thread only asks for it once the picker is opened, which
 * keeps the catalogue out of the main bundle.
 */

type CommentReactionPickerProps = {
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

export const CommentReactionPicker = ({
  onSelect,
  onClose,
}: CommentReactionPickerProps) => {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    if (!query.trim()) {
      return [];
    }
    return searchEmojis(query);
  }, [query]);

  return (
    <div
      className="comment-reaction-picker"
      data-testid="comment-reaction-picker"
      onKeyDown={(event) => {
        // the canvas shortcuts must not fire while the picker is used
        event.stopPropagation();
      }}
    >
      <div className="comment-reaction-picker__header">
        <input
          className="comment-reaction-picker__search"
          type="text"
          value={query}
          placeholder={t("comment.reactionSearch")}
          aria-label={t("comment.reactionSearch")}
          data-testid="comment-reaction-search"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="comment-reaction-picker__close"
          title={t("comment.cancel")}
          aria-label={t("comment.cancel")}
          data-testid="comment-reaction-picker-close"
          onClick={onClose}
        >
          ✕
        </button>
      </div>

      {!query.trim() && (
        <div className="comment-reaction-picker__quick">
          {COMMENT_EMOJI.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="comment-reaction-picker__emoji"
              title={emoji}
              aria-label={emoji}
              data-testid={`comment-reaction-emoji-${emoji}`}
              onClick={() => onSelect(emoji)}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {groups.map((group) => (
        <div
          key={group.category.id}
          className="comment-reaction-picker__group"
          data-testid={`comment-reaction-group-${group.category.id}`}
        >
          {group.entries.map((entry) => (
            <button
              key={entry.name}
              type="button"
              className="comment-reaction-picker__emoji"
              title={entry.name}
              aria-label={entry.name}
              data-testid={`comment-reaction-emoji-${entry.name.replace(
                /\s+/g,
                "-",
              )}`}
              onClick={() => onSelect(entry.char)}
            >
              {entry.char}
            </button>
          ))}
        </div>
      ))}

      {query.trim() && !groups.length && (
        <div
          className="comment-reaction-picker__empty"
          data-testid="comment-reaction-picker-empty"
        >
          {t("comment.noEmojiFound")}
        </div>
      )}
    </div>
  );
};
