import { useEffect, useState } from "react";

import {
  getFacilitationStore,
  getParticipantId,
  subscribeToFacilitationStore,
  watchFacilitationStore,
} from "./storage";

import type { FacilitationStore } from "./storage";

/**
 * Subscribes to the facilitation document.
 *
 * The document lives in `localStorage`, so it is shared by every tab of
 * the browser; the subscription is what keeps the tabs in step.
 */
export const useFacilitationStore = (): FacilitationStore => {
  const [store, setStore] = useState<FacilitationStore>(getFacilitationStore);

  useEffect(() => {
    const unsubscribe = subscribeToFacilitationStore(() => {
      setStore(getFacilitationStore());
    });

    // the document may have changed between the first render and this
    // effect (another tab, or a reload of the scene)
    setStore(getFacilitationStore());

    const unwatch = watchFacilitationStore();

    return () => {
      unsubscribe();
      unwatch();
    };
  }, []);

  return store;
};

/**
 * The id of the participant using this tab.
 *
 * Every tab is a participant of its own, so opening the board twice is
 * enough to watch the votes add up.
 */
export const useParticipantId = (): string => {
  const [participantId] = useState(getParticipantId);
  return participantId;
};
