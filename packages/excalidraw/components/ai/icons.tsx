import { createIcon } from "../icons";

/**
 * The assistant's mark: a sparkle.
 *
 * Drawn in the same hand as the rest of the toolbar's icons, so that it
 * sits next to them without looking like it came from somewhere else.
 */

// tabler-icons: sparkle
export const aiIcon = createIcon(
  <g strokeWidth={1.5}>
    <path stroke="none" d="M0 0h24v24H0z" fill="none" />
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
  </g>,
  {
    width: 24,
    height: 24,
    fill: "none",
    strokeWidth: 2,
    stroke: "currentColor",
    strokeLinecap: "round",
    strokeLinejoin: "round",
  },
);
