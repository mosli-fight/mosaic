import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";

import { Excalidraw } from "../index";

import { getPollData } from "../components/facilitation/types";
import { resetFacilitationStore } from "../components/facilitation/storage";
import { getFacilitationStore } from "../components/facilitation/storage";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

const { h } = window;

const openFacilitationMenu = async () => {
  fireEvent.click(
    document.querySelector<HTMLButtonElement>(
      '[data-testid="facilitation-menu-trigger"]',
    )!,
  );

  await waitFor(() => {
    expect(
      document.querySelector('[data-testid="facilitation-menu"]'),
    ).not.toBe(null);
  });
};

describe("facilitation tools", () => {
  beforeEach(() => {
    resetFacilitationStore();
  });

  describe("the menu", () => {
    it("opens with the three tools of a workshop", async () => {
      await render(<Excalidraw />);

      expect(
        document.querySelector('[data-testid="facilitation-menu-trigger"]'),
      ).not.toBe(null);

      await openFacilitationMenu();

      expect(
        document.querySelector('[data-testid="facilitation-timer-section"]'),
      ).not.toBe(null);
      expect(
        document.querySelector('[data-testid="facilitation-voting-section"]'),
      ).not.toBe(null);
      expect(
        document.querySelector('[data-testid="facilitation-poll-section"]'),
      ).not.toBe(null);
    });
  });

  describe("the timer", () => {
    it("opens a widget that counts down, and can be paused and reset", async () => {
      await render(<Excalidraw />);

      await openFacilitationMenu();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-timer-show"]',
        )!,
      );

      const widget = await waitFor(() => {
        const element = document.querySelector(
          '[data-testid="facilitation-timer"]',
        );
        expect(element).not.toBe(null);
        return element!;
      });

      // the widget counts down from five minutes
      expect(
        widget.querySelector('[data-testid="facilitation-timer-time"]')
          ?.textContent,
      ).toBe("05:00");

      fireEvent.click(
        widget.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-timer-toggle"]',
        )!,
      );

      expect(getFacilitationStore().timer?.status).toBe("running");

      fireEvent.click(
        widget.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-timer-toggle"]',
        )!,
      );

      expect(getFacilitationStore().timer?.status).toBe("paused");

      fireEvent.click(
        widget.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-timer-reset"]',
        )!,
      );

      expect(getFacilitationStore().timer?.status).toBe("idle");
      expect(getFacilitationStore().timer?.remainingMs).toBe(5 * 60 * 1000);
    });

    it("takes the duration the facilitator asks for", async () => {
      await render(<Excalidraw />);

      await openFacilitationMenu();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-timer-show"]',
        )!,
      );

      const minutes = await waitFor(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="facilitation-timer-minutes"]',
        );
        expect(input).not.toBe(null);
        return input!;
      });

      fireEvent.change(minutes, { target: { value: "2" } });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-timer-apply"]',
        )!,
      );

      expect(getFacilitationStore().timer?.durationMs).toBe(2 * 60 * 1000);

      const time = document.querySelector(
        '[data-testid="facilitation-timer-time"]',
      );
      expect(time?.textContent).toBe("02:00");
    });
  });

  describe("voting", () => {
    const setupElements = () => {
      act(() => {
        API.setElements([
          API.createElement({ type: "rectangle", id: "a" }),
          API.createElement({ type: "rectangle", id: "b", x: 200 }),
        ]);
      });
    };

    it("votes on the selected elements only", async () => {
      await render(<Excalidraw />);
      setupElements();

      act(() => {
        API.setAppState({ selectedElementIds: { a: true } });
      });

      await openFacilitationMenu();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-voting-start"]',
        )!,
      );

      expect(getFacilitationStore().voting?.elementIds).toEqual(["a"]);

      const badges = await waitFor(() => {
        const found = document.querySelectorAll(
          '[data-testid="facilitation-vote-badge"]',
        );
        expect(found).toHaveLength(1);
        return found;
      });

      // the badge counts the votes, and votes for the element
      fireEvent.click(badges[0] as HTMLButtonElement);

      expect(getFacilitationStore().voting?.votes.a).toHaveLength(1);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="facilitation-vote-badge"]')
            ?.textContent,
        ).toBe("1");
      });

      // voting again takes the vote back
      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-vote-badge"]',
        )!,
      );

      expect(getFacilitationStore().voting?.votes.a).toHaveLength(0);
    });

    it("ends the session and ranks the results", async () => {
      await render(<Excalidraw />);
      setupElements();

      act(() => {
        API.setAppState({ selectedElementIds: { a: true, b: true } });
      });

      await openFacilitationMenu();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-voting-start"]',
        )!,
      );

      const badges = await waitFor(() => {
        const found = document.querySelectorAll(
          '[data-testid="facilitation-vote-badge"]',
        );
        expect(found).toHaveLength(2);
        return found;
      });

      fireEvent.click(badges[0] as HTMLButtonElement);

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-voting-end"]',
        )!,
      );

      expect(getFacilitationStore().voting?.endedAt).not.toBe(null);

      const results = document.querySelectorAll(
        '[data-testid="facilitation-voting-result"]',
      );
      expect(results).toHaveLength(2);
      expect(results[0].textContent).toContain("1");
    });
  });

  describe("the poll", () => {
    it("creates a poll card on the board", async () => {
      await render(<Excalidraw />);

      await openFacilitationMenu();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-poll-new"]',
        )!,
      );

      const question = await waitFor(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="poll-question-input"]',
        );
        expect(input).not.toBe(null);
        return input!;
      });

      fireEvent.change(question, {
        target: { value: "What do we build next?" },
      });

      const options = document.querySelectorAll<HTMLInputElement>(
        '[data-testid^="poll-option-input-"]',
      );
      expect(options).toHaveLength(2);

      fireEvent.change(options[0], { target: { value: "Search" } });
      fireEvent.change(options[1], { target: { value: "Boards" } });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="poll-form-submit"]',
        )!,
      );

      // the poll is a card on the board
      expect(h.elements).toHaveLength(1);

      const poll = getPollData(h.elements[0]);
      expect(poll?.question).toBe("What do we build next?");
      expect(poll?.options.map((option) => option.text)).toEqual([
        "Search",
        "Boards",
      ]);

      // and it is drawn on the canvas
      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="facilitation-poll-card"]'),
        ).not.toBe(null);
      });
    });

    it("counts the votes of the room", async () => {
      await render(<Excalidraw />);

      await openFacilitationMenu();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-poll-new"]',
        )!,
      );

      const question = await waitFor(() => {
        const input = document.querySelector<HTMLInputElement>(
          '[data-testid="poll-question-input"]',
        );
        expect(input).not.toBe(null);
        return input!;
      });

      fireEvent.change(question, { target: { value: "Which one?" } });

      const options = document.querySelectorAll<HTMLInputElement>(
        '[data-testid^="poll-option-input-"]',
      );
      fireEvent.change(options[0], { target: { value: "A" } });
      fireEvent.change(options[1], { target: { value: "B" } });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="poll-form-submit"]',
        )!,
      );

      const pollOptions = await waitFor(() => {
        const found = document.querySelectorAll(
          '[data-testid="facilitation-poll-option"]',
        );
        expect(found).toHaveLength(2);
        return found;
      });

      fireEvent.click(pollOptions[0] as HTMLButtonElement);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="facilitation-poll-option"]')
            ?.textContent,
        ).toContain("100%");
      });

      // the vote is the participant's own, and it is kept
      const poll = getPollData(h.elements[0]);
      const store = getFacilitationStore();
      expect(Object.values(store.pollVotes[poll!.id])).toHaveLength(1);
    });
  });
});
