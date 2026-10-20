import { useCallback, useMemo, useRef, useState } from "react";
import clsx from "clsx";

import { t } from "../i18n";

import { COMMENT_EMOJI } from "./commentEmoji";

import type { CommentAuthor } from "./types";

type MentionCandidate = {
  id: string;
  name: string;
};

type CommentComposerProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  placeholder: string;
  /** people the author can @mention */
  mentionCandidates?: MentionCandidate[];
  autoFocus?: boolean;
  className?: string;
  "data-testid"?: string;
  /** testid of the textarea — several composers can be mounted at once */
  inputTestId?: string;
  submitTestId?: string;
  cancelTestId?: string;
};

/**
 * Finds the mention query the caret currently sits in, if any.
 *
 * A mention starts at an "@" that is at the start of the text or preceded
 * by whitespace, and runs until the caret. Returns the query and the index
 * the "@" sits at, so the mention can be replaced wholesale when picked.
 */
const findMention = (
  value: string,
  caret: number,
): { query: string; start: number } | null => {
  const upto = value.slice(0, caret);
  const at = upto.lastIndexOf("@");
  if (at === -1) {
    return null;
  }
  const before = at === 0 ? "" : upto[at - 1];
  if (before && !/\s/.test(before)) {
    // not a mention — e.g. an email address
    return null;
  }
  const query = upto.slice(at + 1);
  if (/\s/.test(query)) {
    // the mention was already completed
    return null;
  }
  return { query, start: at };
};

/**
 * The comment composer — a textarea with @mention and emoji support.
 *
 * Used both for the first message of a thread and for replies, so the two
 * can't drift apart visually.
 */
export const CommentComposer = ({
  value,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  placeholder,
  mentionCandidates = [],
  autoFocus,
  className,
  "data-testid": dataTestId,
  inputTestId = "comment-composer-input",
  submitTestId = "comment-composer-submit",
  cancelTestId = "comment-composer-cancel",
}: CommentComposerProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mention, setMention] = useState<{
    query: string;
    start: number;
  } | null>(null);
  const [isEmojiOpen, setIsEmojiOpen] = useState(false);

  const filteredCandidates = useMemo(() => {
    if (!mention) {
      return [];
    }
    const query = mention.query.toLowerCase();
    return mentionCandidates
      .filter((candidate) => candidate.name.toLowerCase().includes(query))
      .slice(0, 6);
  }, [mention, mentionCandidates]);

  const syncMention = useCallback((text: string, caret: number) => {
    setMention(findMention(text, caret));
  }, []);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const text = event.target.value;
      onChange(text);
      syncMention(text, event.target.selectionStart ?? text.length);
    },
    [onChange, syncMention],
  );

  const insertAtCaret = useCallback(
    (snippet: string) => {
      const textarea = textareaRef.current;
      const text = value;
      const caret = textarea?.selectionStart ?? text.length;
      const next = `${text.slice(0, caret)}${snippet}${text.slice(caret)}`;
      onChange(next);
      // restore the caret after the controlled value round-trips
      requestAnimationFrame(() => {
        textarea?.focus();
        const nextCaret = caret + snippet.length;
        textarea?.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [onChange, value],
  );

  const pickMention = useCallback(
    (candidate: MentionCandidate) => {
      const textarea = textareaRef.current;
      const text = value;
      const caret = textarea?.selectionStart ?? text.length;
      const start = mention ? mention.start : caret;
      const snippet = `@${candidate.name} `;
      const next = `${text.slice(0, start)}${snippet}${text.slice(caret)}`;
      onChange(next);
      setMention(null);
      requestAnimationFrame(() => {
        textarea?.focus();
        const nextCaret = start + snippet.length;
        textarea?.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [mention, onChange, value],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCancel();
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        onSubmit();
        return;
      }
      if (mention && filteredCandidates.length) {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
        }
      }
    },
    [filteredCandidates.length, mention, onCancel, onSubmit],
  );

  return (
    <div
      className={clsx("comment-composer", className)}
      data-testid={dataTestId}
    >
      <div className="comment-composer__input-wrapper">
        <textarea
          ref={textareaRef}
          className="comment-composer__input"
          value={value}
          placeholder={placeholder}
          autoFocus={autoFocus}
          rows={2}
          data-testid={inputTestId}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onKeyUp={(event) =>
            syncMention(
              event.currentTarget.value,
              event.currentTarget.selectionStart ??
                event.currentTarget.value.length,
            )
          }
          onClick={(event) =>
            syncMention(
              event.currentTarget.value,
              event.currentTarget.selectionStart ??
                event.currentTarget.value.length,
            )
          }
        />
        <div className="comment-composer__toolbar">
          <button
            type="button"
            className="comment-composer__tool"
            title={t("comment.mentionHint")}
            aria-label={t("comment.mentionHint")}
            data-testid="comment-mention-button"
            onClick={() => {
              insertAtCaret("@");
            }}
          >
            @
          </button>
          <div className="comment-composer__emoji">
            <button
              type="button"
              className="comment-composer__tool"
              title="Emoji"
              aria-label="Emoji"
              aria-expanded={isEmojiOpen}
              data-testid="comment-emoji-button"
              onClick={() => setIsEmojiOpen((open) => !open)}
            >
              🙂
            </button>
            {isEmojiOpen && (
              <div
                className="comment-composer__emoji-grid"
                data-testid="comment-emoji-grid"
              >
                {COMMENT_EMOJI.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    className="comment-composer__emoji-item"
                    title={emoji}
                    aria-label={emoji}
                    onClick={() => {
                      insertAtCaret(emoji);
                      setIsEmojiOpen(false);
                    }}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        {mention && filteredCandidates.length > 0 && (
          <div
            className="comment-composer__mentions"
            data-testid="comment-mentions"
          >
            {filteredCandidates.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="comment-composer__mention"
                data-testid={`comment-mention-${candidate.id}`}
                onClick={() => pickMention(candidate)}
              >
                {candidate.name}
              </button>
            ))}
          </div>
        )}
        {mention && filteredCandidates.length === 0 && (
          <div
            className="comment-composer__mentions comment-composer__mentions--empty"
            data-testid="comment-mentions-empty"
          >
            {t("comment.noMentions")}
          </div>
        )}
      </div>
      <div className="comment-composer__actions">
        <button
          type="button"
          className="comment-composer__action comment-composer__action--secondary"
          data-testid={cancelTestId}
          onClick={onCancel}
        >
          {t("comment.cancel")}
        </button>
        <button
          type="button"
          className="comment-composer__action comment-composer__action--primary"
          disabled={!value.trim()}
          data-testid={submitTestId}
          onClick={onSubmit}
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
};

/**
 * The people the current user can @mention: everyone else in the session.
 */
export const getMentionCandidates = (
  collaborators: Map<string, { username?: string | null }>,
  currentUser: CommentAuthor,
): MentionCandidate[] => {
  const candidates = new Map<string, MentionCandidate>();
  for (const [socketId, collaborator] of collaborators) {
    if (!collaborator.username || socketId === currentUser.id) {
      continue;
    }
    candidates.set(socketId, { id: socketId, name: collaborator.username });
  }
  return [...candidates.values()];
};
