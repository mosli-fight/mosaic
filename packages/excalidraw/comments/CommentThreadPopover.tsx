import { lazy, Suspense, useMemo, useState } from "react";
import clsx from "clsx";

import { t } from "../i18n";

import {
  commentResolvedIcon,
  commentDeleteIcon,
  commentAttachIcon,
} from "../components/icons";

import { CommentComposer } from "./CommentComposer";
import { CommentText } from "./CommentText";
import { formatCommentTime, parseMentions } from "./commentUtils";

import type {
  CommentAuthor,
  CommentCandidate,
  CommentMention,
  CommentThread,
} from "./types";

/**
 * The reaction picker carries the whole emoji catalogue with it, so it is
 * only fetched once somebody asks for it.
 */
const ReactionPicker = lazy(() =>
  import("./CommentReactionPicker").then((module) => ({
    default: module.CommentReactionPicker,
  })),
);

/** the pencil of the edit button */
const commentEditIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

type CommentThreadPopoverProps = {
  thread: CommentThread;
  currentUser: CommentAuthor;
  mentionCandidates: CommentCandidate[];
  onReply: (text: string, mentions: CommentMention[]) => void;
  onEditMessage: (
    messageId: string,
    text: string,
    mentions: CommentMention[],
  ) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onToggleResolve: () => void;
  /** attaches the thread to the element under its pin, or detaches it */
  onToggleAttachment?: () => void;
  /** whether the pin of the thread follows an element */
  attached?: boolean;
  onDelete: () => void;
  onClose: () => void;
  /** view mode — the thread can be read, but not replied to or resolved */
  readOnly?: boolean;
  className?: string;
};

/**
 * The thread popover — the conversation behind a pin.
 *
 * Lists the messages, offers a reply box, and lets the author resolve or
 * delete the thread. A message can be edited by the person who wrote it,
 * and any message can be reacted to with an emoji.
 */
export const CommentThreadPopover = ({
  thread,
  currentUser,
  mentionCandidates,
  onReply,
  onEditMessage,
  onToggleReaction,
  onToggleResolve,
  onToggleAttachment,
  attached,
  onDelete,
  onClose,
  readOnly,
  className,
}: CommentThreadPopoverProps) => {
  const [reply, setReply] = useState("");
  /** the message being edited, if any */
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  /** the message whose reaction picker is open, if any */
  const [pickerMessageId, setPickerMessageId] = useState<string | null>(null);

  /** everybody mentioned anywhere in this thread */
  const mentionedPeople = useMemo(() => {
    const people = new Map<string, CommentMention>();
    for (const message of thread.messages) {
      for (const mention of message.mentions ?? []) {
        people.set(mention.id, mention);
      }
    }
    return [...people.values()];
  }, [thread.messages]);

  const submitReply = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    onReply(trimmed, parseMentions(trimmed, mentionCandidates));
    setReply("");
  };

  return (
    <div
      className={clsx("comment-thread", className)}
      data-testid="comment-thread"
      onKeyDown={(event) => {
        // keep the canvas shortcuts from firing while the thread is focused
        event.stopPropagation();
      }}
    >
      <div className="comment-thread__header">
        <span className="comment-thread__title">
          {thread.resolved ? t("comment.resolved") : t("comment.open")}
          {attached && (
            <span
              className="comment-thread__attached-badge"
              data-testid="comment-thread-attached"
            >
              {t("comment.attachedToElement")}
            </span>
          )}
        </span>
        <div className="comment-thread__header-actions">
          {onToggleAttachment && (
            <button
              type="button"
              className="comment-thread__icon-button"
              title={attached ? t("comment.detach") : t("comment.attach")}
              aria-label={attached ? t("comment.detach") : t("comment.attach")}
              aria-pressed={!!attached}
              data-testid="comment-attach-button"
              onClick={onToggleAttachment}
            >
              {commentAttachIcon}
            </button>
          )}
          {!readOnly && (
            <>
              <button
                type="button"
                className="comment-thread__icon-button"
                title={
                  thread.resolved
                    ? t("comment.unresolve")
                    : t("comment.resolve")
                }
                aria-label={
                  thread.resolved
                    ? t("comment.unresolve")
                    : t("comment.resolve")
                }
                aria-pressed={thread.resolved}
                data-testid="comment-resolve-button"
                onClick={onToggleResolve}
              >
                {commentResolvedIcon}
              </button>
              <button
                type="button"
                className="comment-thread__icon-button comment-thread__icon-button--danger"
                title={t("comment.deleteThread")}
                aria-label={t("comment.deleteThread")}
                data-testid="comment-delete-button"
                onClick={onDelete}
              >
                {commentDeleteIcon}
              </button>
            </>
          )}
          <button
            type="button"
            className="comment-thread__icon-button"
            title={t("comment.cancel")}
            aria-label={t("comment.cancel")}
            data-testid="comment-thread-close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
      </div>

      {mentionedPeople.length > 0 && (
        <div
          className="comment-thread__mentions"
          data-testid="comment-thread-mentions"
        >
          {mentionedPeople.map((mention) => (
            <span
              key={mention.id}
              className="comment-thread__mention-chip"
              data-testid="comment-thread-mention"
            >
              @{mention.name}
            </span>
          ))}
        </div>
      )}

      <div className="comment-thread__messages" data-testid="comment-messages">
        {thread.messages.map((message) => {
          const isOwn = message.author.id === currentUser.id;
          const isEditing = editingMessageId === message.id;

          return (
            <div
              key={message.id}
              className="comment-thread__message"
              data-testid="comment-message"
              data-message-id={message.id}
            >
              <span
                className="comment-thread__avatar"
                style={{
                  backgroundColor: message.author.color,
                }}
                aria-hidden="true"
              >
                {(message.author.name || "?").charAt(0).toUpperCase()}
              </span>
              <div className="comment-thread__message-body">
                <div className="comment-thread__message-meta">
                  <span className="comment-thread__author">
                    {message.author.name || t("comment.anonymous")}
                  </span>
                  <span className="comment-thread__time">
                    {formatCommentTime(message.createdAt)}
                  </span>
                  {message.edited && (
                    <span
                      className="comment-thread__edited"
                      data-testid="comment-edited-badge"
                    >
                      {t("comment.edited")}
                    </span>
                  )}
                  {isOwn && !readOnly && !isEditing && (
                    <button
                      type="button"
                      className="comment-thread__edit-button"
                      title={t("comment.edit")}
                      aria-label={t("comment.edit")}
                      data-testid="comment-edit-button"
                      onClick={() => {
                        setEditingMessageId(message.id);
                        setPickerMessageId(null);
                      }}
                    >
                      {commentEditIcon}
                    </button>
                  )}
                </div>

                {isEditing ? (
                  <CommentEditor
                    initialText={message.text}
                    mentionCandidates={mentionCandidates}
                    onSave={(text, mentions) => {
                      onEditMessage(message.id, text, mentions);
                      setEditingMessageId(null);
                    }}
                    onCancel={() => setEditingMessageId(null)}
                  />
                ) : (
                  <>
                    <div className="comment-thread__text">
                      <CommentText
                        text={message.text}
                        mentions={message.mentions}
                      />
                    </div>

                    <div
                      className="comment-thread__reactions"
                      data-testid="comment-reactions"
                    >
                      {(message.reactions ?? []).map((reaction) => {
                        const isMine = reaction.authorIds.includes(
                          currentUser.id,
                        );
                        return (
                          <button
                            key={reaction.emoji}
                            type="button"
                            className={clsx("comment-reaction", {
                              "comment-reaction--mine": isMine,
                            })}
                            aria-pressed={isMine}
                            title={`${reaction.emoji} ${reaction.authorIds.length}`}
                            data-testid={`comment-reaction-${reaction.emoji}`}
                            onClick={() =>
                              onToggleReaction(message.id, reaction.emoji)
                            }
                          >
                            <span className="comment-reaction__emoji">
                              {reaction.emoji}
                            </span>
                            <span className="comment-reaction__count">
                              {reaction.authorIds.length}
                            </span>
                          </button>
                        );
                      })}

                      {!readOnly && (
                        <button
                          type="button"
                          className="comment-thread__add-reaction"
                          title={t("comment.addReaction")}
                          aria-label={t("comment.addReaction")}
                          data-testid="comment-add-reaction"
                          onClick={() =>
                            setPickerMessageId(
                              pickerMessageId === message.id
                                ? null
                                : message.id,
                            )
                          }
                        >
                          🙂
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pickerMessageId && (
        <Suspense fallback={null}>
          <ReactionPicker
            onSelect={(emoji) => {
              onToggleReaction(pickerMessageId, emoji);
              setPickerMessageId(null);
            }}
            onClose={() => setPickerMessageId(null)}
          />
        </Suspense>
      )}

      {!readOnly && (
        <div className="comment-thread__reply">
          <CommentComposer
            value={reply}
            onChange={setReply}
            onSubmit={() => submitReply(reply)}
            onCancel={onClose}
            submitLabel={t("comment.reply")}
            placeholder={t("comment.replyPlaceholder")}
            mentionCandidates={mentionCandidates}
            data-testid="comment-reply-composer"
            inputTestId="comment-reply-input"
            submitTestId="comment-reply-submit"
            cancelTestId="comment-reply-cancel"
          />
        </div>
      )}
      <span className="comment-thread__signed-in-as">
        {currentUser.name
          ? `${t("comment.reply")} · ${currentUser.name}`
          : null}
      </span>
    </div>
  );
};

/**
 * The inline editor of a message.
 *
 * It is a plain textarea rather than the shared composer: an edit is a
 * single field with two buttons, and the composer's emoji and mention
 * toolbars would come along for a job they are not asked to do.
 */
const CommentEditor = ({
  initialText,
  mentionCandidates,
  onSave,
  onCancel,
}: {
  initialText: string;
  mentionCandidates: CommentCandidate[];
  onSave: (text: string, mentions: CommentMention[]) => void;
  onCancel: () => void;
}) => {
  const [text, setText] = useState(initialText);

  const save = () => {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }
    onSave(trimmed, parseMentions(trimmed, mentionCandidates));
  };

  return (
    <div className="comment-thread__editor" data-testid="comment-editor">
      <textarea
        className="comment-thread__editor-input"
        value={text}
        rows={2}
        autoFocus
        data-testid="comment-editor-input"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            save();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="comment-thread__editor-actions">
        <button
          type="button"
          className="comment-composer__action comment-composer__action--secondary"
          data-testid="comment-editor-cancel"
          onClick={onCancel}
        >
          {t("comment.cancel")}
        </button>
        <button
          type="button"
          className="comment-composer__action comment-composer__action--primary"
          disabled={!text.trim()}
          data-testid="comment-editor-save"
          onClick={save}
        >
          {t("comment.save")}
        </button>
      </div>
    </div>
  );
};
