/**
 * The diagram's icon.
 *
 * Shared by the toolbar button and the pane's header so the two cannot drift
 * apart, and kept out of both so neither has to import the other.
 */
export const diagramIcon = (
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
    <rect x="3" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="16" width="7" height="5" rx="1" />
    <path d="M6.5 8v4a2 2 0 0 0 2 2h9a2 2 0 0 1 2 2v0" />
  </svg>
);
