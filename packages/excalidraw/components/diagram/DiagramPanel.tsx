/**
 * The way into the diagram-as-code pane.
 *
 * The pane itself — its parser, layout and scene builder — is a lazily
 * loaded chunk. This wrapper is the only thing the editor's main bundle
 * carries: it watches the pane's open state and only then asks for the
 * chunk, so a board that never opens the pane never downloads it.
 *
 * The chunk is requested on first open and kept mounted afterwards, so
 * closing and reopening the pane does not re-parse or re-seed the board.
 */

import { Suspense, lazy, useEffect, useState } from "react";

import { useDiagramPanelOpen } from "./panelStore";

const DiagramPanelBody = lazy(() =>
  import("./DiagramPanelBody").then((module) => ({
    default: module.DiagramPanelBody,
  })),
);

/**
 * The pane, or nothing while it is closed.
 *
 * `wasOpened` is what keeps the chunk alive after a close: the body stays
 * mounted (hidden by its own open check) so its refs survive a toggle.
 */
export const DiagramPanel = () => {
  const isOpen = useDiagramPanelOpen();
  const [wasOpened, setWasOpened] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setWasOpened(true);
    }
  }, [isOpen]);

  if (!wasOpened) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <DiagramPanelBody />
    </Suspense>
  );
};
