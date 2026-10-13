import { Footer } from "@excalidraw/excalidraw/index";
import React from "react";

import { isExcalidrawPlusSignedUser } from "../app_constants";
import { dashboardUrl, getBoardIdFromHash } from "../boardMode";

import { DebugFooter, isVisualDebuggerEnabled } from "./DebugCanvas";
import { EncryptedIcon } from "./EncryptedIcon";

export const AppFooter = React.memo(
  ({ onChange }: { onChange: () => void }) => {
    // Board mode only (Part 2, STEP 6): offer a way back to the dashboard that
    // opened this editor. `useState` is not needed because the hash does not
    // change while the editor is open, so reading it once per render is enough.
    const boardId = getBoardIdFromHash();

    return (
      <Footer>
        <div
          style={{
            display: "flex",
            gap: ".5rem",
            alignItems: "center",
          }}
        >
          {boardId ? (
            <a
              href={dashboardUrl()}
              // Without target="_top" this link navigates the *iframe* rather
              // than the page, so the dashboard renders inside the editor frame
              // and the user sees nothing happen. Observed:
              //
              //   URL_BEFORE: /board/586b898e-...
              //   URL_AFTER:  /board/586b898e-...      unchanged
              //   FRAME       http://localhost:3101/dashboard
              //
              // which leaves the board page stranded with a dashboard hidden in
              // its own iframe. "_top" makes the navigation replace the top-level
              // document, which is the whole point of the control.
              target="_top"
              // The dashboard is same-origin, so noopener buys nothing here, but
              // it keeps the door closed if VITE_DASHBOARD_URL is ever pointed
              // at another host.
              rel="noopener"
              className="modal-drawer-link mosaic-back-link"
              data-testid="back-to-dashboard"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: ".35rem",
                fontSize: ".8rem",
              }}
            >
              ← Back to dashboard
            </a>
          ) : null}
          {isVisualDebuggerEnabled() && <DebugFooter onChange={onChange} />}
          {!isExcalidrawPlusSignedUser && <EncryptedIcon />}
        </div>
      </Footer>
    );
  },
);
