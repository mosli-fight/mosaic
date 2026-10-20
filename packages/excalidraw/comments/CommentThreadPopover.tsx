import { useState } from "react";
import clsx from "clsx";

import { t } from "../i18n";

import { commentResolvedIcon, commentDeleteIcon } from "../components/icons";

import { CommentComposer } from "./CommentComposer";
import { formatCommentTime } from "./commentUtils";

import type { CommentAuthor, CommentThread } from "./types";

type CommentThreadPopoverProps = {
  thread: CommentThread;
  currentUser: CommentAuthor;
  mentionCandidates: { id: string; name: string }[];
  onReply: (text: string) => void;
  onToggleResolve: () => void;
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
 * delete the thread.
 */
export const CommentThreadPopover = ({
  thread,
  currentUser,
  mentionCandidates,
  onReply,
  onToggleResolve,
  onDelete,
  onClose,
  readOnly,
  className,
}: CommentThreadPopoverProps) => {
  const [reply, setReply] = useState("");

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
        </span>
        <div className="comment-thread__header-actions">
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

      <div className="comment-thread__messages" data-testid="comment-messages">
        {thread.messages.map((message) => (
          <div
            key={message.id}
            className="comment-thread__message"
            data-testid="comment-message"
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
              </div>
              <div className="comment-thread__text">{message.text}</div>
            </div>
          </div>
        ))}
      </div>

      {!readOnly && (
        <div className="comment-thread__reply">
          <CommentComposer
            value={reply}
            onChange={setReply}
            onSubmit={() => {
              const text = reply.trim();
              if (!text) {
                return;
              }
              onReply(text);
              setReply("");
            }}
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
