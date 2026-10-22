import { Fragment } from "react";

import { splitTextByMentions } from "./commentUtils";

import type { CommentMention } from "./types";

/**
 * A comment's text, with the mentions drawn as highlighted tokens.
 *
 * The text itself is left untouched — the mention is only a different way of
 * drawing the "@Name" that is already in it, so copying the comment out of
 * the editor still gives the plain text.
 *
 * The component deliberately renders no wrapper element: the plain parts of
 * the text stay direct text children of whatever holds them, which keeps
 * the text of a comment readable to the accessibility tree and to the tests
 * that look for it.
 */
export const CommentText = ({
  text,
  mentions,
}: {
  text: string;
  mentions?: readonly CommentMention[];
}) => {
  const segments = splitTextByMentions(text, mentions ?? []);

  return (
    <>
      {segments.map((segment, index) =>
        segment.type === "mention" ? (
          <span
            key={index}
            className="comment-mention"
            data-testid="comment-mention-token"
          >
            {segment.text}
          </span>
        ) : (
          <Fragment key={index}>{segment.text}</Fragment>
        ),
      )}
    </>
  );
};
