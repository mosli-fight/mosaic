import { useState } from "react";

import { Popover } from "radix-ui";

import { t } from "../../i18n";

import { useExcalidrawContainer } from "../App";
import { facilitationIcon } from "../icons";

import { PollSection } from "./PollSection";
import { TimerSection } from "./TimerSection";
import { VotingSection } from "./VotingSection";

import "./facilitation.scss";

/**
 * The facilitation menu.
 *
 * One entry in the top bar, one panel with the three tools a workshop
 * needs: a timer for the agenda, a vote on what is on the board, and a
 * poll the room can answer.
 */
export const FacilitationMenu = () => {
  const { container } = useExcalidrawContainer();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="facilitation-menu__trigger"
          title={t("facilitation.menu.title")}
          aria-label={t("facilitation.menu.title")}
          data-testid="facilitation-menu-trigger"
        >
          {facilitationIcon}
          <span className="facilitation-menu__trigger-label">
            {t("facilitation.menu.title")}
          </span>
        </button>
      </Popover.Trigger>

      <Popover.Content
        className="facilitation-menu__content"
        side="bottom"
        align="end"
        sideOffset={12}
        collisionBoundary={container ?? undefined}
        onKeyDown={(event) => {
          // the panel holds inputs: their keys must not reach the editor
          event.stopPropagation();
        }}
        data-testid="facilitation-menu"
      >
        <div className="facilitation-panel">
          <h3 className="facilitation-panel__title">
            {t("facilitation.menu.title")}
          </h3>

          <TimerSection />
          <VotingSection />
          <PollSection />
        </div>
      </Popover.Content>
    </Popover.Root>
  );
};
