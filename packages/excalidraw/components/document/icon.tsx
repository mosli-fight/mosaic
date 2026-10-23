/**
 * The document pane's icon.
 *
 * Shared by the toolbar button and the pane's header so the two cannot
 * drift apart, and kept out of both so neither has to import the other.
 */
export const documentIcon = (
  <svg
    aria-hidden="true"
    focusable="false"
    role="img"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 3h8l4 4v14H6z" />
    <path d="M14 3v4h4" />
    <path d="M9 12h6M9 16h6M9 8h2" />
  </svg>
);
