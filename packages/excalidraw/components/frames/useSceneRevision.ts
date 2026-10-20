import { useEffect, useReducer } from "react";

import { useApp } from "../App";

import type App from "../App";

/**
 * Re-renders the caller whenever the scene changes.
 *
 * The frames panel and the present mode both read the scene rather than
 * the app state — a frame is an element, and what is on the board is the
 * scene's business — so they follow it directly.
 */
export const useSceneRevision = () => {
  const app = useApp() as App;
  const [, forceUpdate] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const unbind = app.scene.onUpdate(forceUpdate);

    return () => {
      try {
        unbind();
      } catch {
        // the editor tore the scene down before this component unmounted —
        // there is nothing left to unbind
      }
    };
  }, [app.scene]);
};
