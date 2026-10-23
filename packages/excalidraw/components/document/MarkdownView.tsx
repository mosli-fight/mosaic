/**
 * Draws a parsed document.
 *
 * The parser hands over a block list and this turns it into React nodes:
 * no HTML string is ever produced, so nothing typed into the notes can
 * become markup. A checklist box is a real checkbox, and ticking it hands
 * the line back to the pane, which rewrites that one line of the source.
 */

import { normalizeLink } from "@excalidraw/common";

import type {
  InlineNode,
  ListItem,
  MarkdownBlock,
  NestedListItem,
  TableAlignment,
} from "./markdown";

import { nestListItems } from "./markdown";

/** how a table column is aligned */
const alignmentClass = (alignment: TableAlignment) =>
  `document-markdown__cell--${alignment}`;

/** draws the inline runs of one block */
const renderInline = (nodes: InlineNode[], keyPrefix: string) =>
  nodes.map((node, index) => {
    const key = `${keyPrefix}-${index}`;

    switch (node.type) {
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "code":
        return (
          <code key={key} className="document-markdown__code-inline">
            {node.text}
          </code>
        );
      case "link":
        return (
          <a
            key={key}
            href={normalizeLink(node.href)}
            target="_blank"
            rel="noopener noreferrer"
          >
            {renderInline(node.children, key)}
          </a>
        );
      default:
        return node.text;
    }
  });

/** draws one list, nesting the items that are indented under another */
const renderList = (
  items: NestedListItem[],
  ordered: boolean,
  onToggleItem: (line: number) => void,
  keyPrefix: string,
) => {
  const ListTag = ordered ? "ol" : "ul";

  return (
    <ListTag key={keyPrefix} className="document-markdown__list">
      {items.map((item) => (
        <li
          key={`${keyPrefix}-${item.line}`}
          className={
            item.marker === "checkbox"
              ? "document-markdown__list-item document-markdown__list-item--check"
              : "document-markdown__list-item"
          }
        >
          {item.marker === "checkbox" ? (
            <label className="document-markdown__check">
              <input
                type="checkbox"
                checked={!!item.checked}
                onChange={() => onToggleItem(item.line)}
                data-testid={`document-check-${item.line}`}
              />
              <span
                className={
                  item.checked
                    ? "document-markdown__check-text document-markdown__check-text--done"
                    : "document-markdown__check-text"
                }
              >
                {renderInline(item.content, `${keyPrefix}-${item.line}`)}
              </span>
            </label>
          ) : (
            <span>{renderInline(item.content, `${keyPrefix}-${item.line}`)}</span>
          )}

          {item.children.length > 0 &&
            renderList(
              item.children,
              ordered,
              onToggleItem,
              `${keyPrefix}-${item.line}-nested`,
            )}
        </li>
      ))}
    </ListTag>
  );
};

/** draws one list item's marker, for the flat list case */
const listItemKey = (item: ListItem) => item.line;

export type MarkdownViewProps = {
  blocks: MarkdownBlock[];
  /** called with the source line of a checklist item that was ticked */
  onToggleChecklistItem: (line: number) => void;
};

/**
 * The rendered document.
 */
export const MarkdownView = ({
  blocks,
  onToggleChecklistItem,
}: MarkdownViewProps) => {
  if (!blocks.length) {
    return (
      <div className="document-markdown document-markdown--empty">
        <p className="document-markdown__empty">Nothing written yet.</p>
      </div>
    );
  }

  return (
    <div className="document-markdown" data-testid="document-markdown">
      {blocks.map((block) => {
        const key = `${block.type}-${block.line}`;

        switch (block.type) {
          case "heading": {
            const HeadingTag = `h${Math.min(block.level, 6)}` as
              | "h1"
              | "h2"
              | "h3"
              | "h4"
              | "h5"
              | "h6";

            return (
              <HeadingTag
                key={key}
                className={`document-markdown__heading document-markdown__heading--${block.level}`}
              >
                {renderInline(block.content, key)}
              </HeadingTag>
            );
          }

          case "paragraph":
            return (
              <p key={key} className="document-markdown__paragraph">
                {renderInline(block.content, key)}
              </p>
            );

          case "list":
            return (
              <div key={key} className="document-markdown__list-block">
                {renderList(
                  nestListItems(block.items),
                  block.ordered,
                  onToggleChecklistItem,
                  `list-${listItemKey(block.items[0])}`,
                )}
              </div>
            );

          case "code":
            return (
              <div key={key} className="document-markdown__code-block">
                {block.language && (
                  <span className="document-markdown__code-language">
                    {block.language}
                  </span>
                )}
                <pre className="document-markdown__pre">
                  <code>{block.code}</code>
                </pre>
              </div>
            );

          case "table":
            return (
              <div key={key} className="document-markdown__table-wrap">
                <table className="document-markdown__table">
                  <thead>
                    <tr>
                      {block.header.map((cell, index) => (
                        <th
                          key={`${key}-h-${index}`}
                          className={alignmentClass(
                            block.alignments[index] ?? "left",
                          )}
                        >
                          {renderInline(cell, `${key}-h-${index}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {block.rows.map((row, rowIndex) => (
                      <tr key={`${key}-r-${rowIndex}`}>
                        {row.map((cell, cellIndex) => (
                          <td
                            key={`${key}-r-${rowIndex}-${cellIndex}`}
                            className={alignmentClass(
                              block.alignments[cellIndex] ?? "left",
                            )}
                          >
                            {renderInline(
                              cell,
                              `${key}-r-${rowIndex}-${cellIndex}`,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );

          case "divider":
            return (
              <hr key={key} className="document-markdown__divider" />
            );

          default:
            return null;
        }
      })}
    </div>
  );
};
