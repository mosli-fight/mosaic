import fs from "fs";
import path from "path";

import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";

import { Excalidraw } from "../index";

import { getPollData } from "../components/facilitation/types";
import { resetFacilitationStore } from "../components/facilitation/storage";
import { getFacilitationStore } from "../components/facilitation/storage";

import { API } from "./helpers/api";
import { act, createEvent, render } from "./test-utils";

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

/**
 * Creates a poll card on the board, through the menu, and waits for it to
 * be drawn. Returns the card's options.
 */
const createPollCard = async (
  question = "Which one?",
  options = ["A", "B"],
) => {
  await openFacilitationMenu();

  fireEvent.click(
    document.querySelector<HTMLButtonElement>(
      '[data-testid="facilitation-poll-new"]',
    )!,
  );

  const questionInput = await waitFor(() => {
    const input = document.querySelector<HTMLInputElement>(
      '[data-testid="poll-question-input"]',
    );
    expect(input).not.toBe(null);
    return input!;
  });

  fireEvent.change(questionInput, { target: { value: question } });

  const optionInputs = document.querySelectorAll<HTMLInputElement>(
    '[data-testid^="poll-option-input-"]',
  );
  expect(optionInputs).toHaveLength(options.length);

  options.forEach((text, index) => {
    fireEvent.change(optionInputs[index], { target: { value: text } });
  });

  fireEvent.click(
    document.querySelector<HTMLButtonElement>(
      '[data-testid="poll-form-submit"]',
    )!,
  );

  return await waitFor(() => {
    const found = document.querySelectorAll(
      '[data-testid="facilitation-poll-option"]',
    );
    expect(found).toHaveLength(options.length);
    return found;
  });
};

/** reads one of the stylesheets of the package */
const readScss = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, "..", relativePath), "utf8");

/** the value of a z-index custom property, as `:root` defines it */
const zIndexToken = (scss: string, name: string) => {
  const match = scss.match(new RegExp(`--${name}:\\s*(\\d+)\\s*;`));

  return match ? Number(match[1]) : null;
};

/** the body of a css rule, nested rules included */
const cssRule = (scss: string, selector: string) => {
  const start = scss.indexOf(`${selector} {`);

  if (start === -1) {
    return null;
  }

  let depth = 0;

  for (let i = scss.indexOf("{", start); i < scss.length; i++) {
    if (scss[i] === "{") {
      depth++;
    } else if (scss[i] === "}") {
      depth--;

      if (depth === 0) {
        return scss.slice(start, i + 1);
      }
    }
  }

  return null;
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

      // the badge has the focus: the editor must not answer Enter, or it
      // would start editing the element instead of voting
      const enter = createEvent.keyDown(badges[0] as HTMLButtonElement, {
        key: "Enter",
      });
      fireEvent(badges[0] as HTMLButtonElement, enter);

      expect(enter.defaultPrevented).toBe(false);
      expect(h.state.editingTextElement).toBe(null);

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

      await createPollCard("What do we build next?", ["Search", "Boards"]);

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

      const pollOptions = await createPollCard();

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

    it("draws the card above the canvas, so that its buttons can be clicked", async () => {
      await render(<Excalidraw />);

      await createPollCard();

      // the card is drawn inside the layer of the board's widgets
      const card = document.querySelector(
        '[data-testid="facilitation-poll-card"]',
      );
      expect(card?.closest(".facilitation-layer")).not.toBe(null);

      // the canvas is drawn in two layers, and the interactive one covers
      // the whole board: a widget that is painted below it is hidden, and
      // the canvas takes its clicks
      const styles = readScss("css/styles.scss");
      const facilitation = readScss(
        "components/facilitation/facilitation.scss",
      );

      const interactiveCanvas = zIndexToken(styles, "zIndex-interactiveCanvas");
      const canvasWidgets = zIndexToken(styles, "zIndex-canvasWidgets");

      expect(interactiveCanvas).not.toBeNull();
      expect(canvasWidgets).not.toBeNull();
      expect(canvasWidgets!).toBeGreaterThan(interactiveCanvas!);

      // the layer of the widgets is painted above the canvas
      expect(cssRule(facilitation, ".facilitation-layer")).toContain(
        "z-index: var(--zIndex-canvasWidgets)",
      );

      // and it does not hide the other overlays of the canvas: they are
      // drawn after it
      const layer = document.querySelector(".facilitation-layer")!;
      const svgLayer = document.querySelector(".SVGLayer")!;

      expect(
        layer.compareDocumentPosition(svgLayer) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();

      // the card lets the clicks that are not on a control fall through to
      // the canvas, so that it can still be moved — its controls take them
      // back
      expect(cssRule(facilitation, ".facilitation-poll-card")).toContain(
        "pointer-events: none",
      );
      expect(
        cssRule(facilitation, ".facilitation-poll-card__option"),
      ).toContain("pointer-events: auto");
    });

    it("votes with the keyboard, without the editor stealing the keys", async () => {
      await render(<Excalidraw />);

      const pollOptions = await createPollCard();

      const option = pollOptions[0] as HTMLButtonElement;

      // the vote is cast with a real button, so that it can be reached
      // with the keyboard
      expect(option.tagName).toBe("BUTTON");
      expect(option.type).toBe("button");
      expect(option.disabled).toBe(false);

      // the card's shape is selected, as it is right after it is created
      expect(h.state.selectedElementIds[h.elements[0].id]).toBe(true);

      // the widget has the focus: the editor must not answer Enter, or it
      // would start editing the card's shape instead of voting
      const enter = createEvent.keyDown(option, { key: "Enter" });
      fireEvent(option, enter);

      expect(enter.defaultPrevented).toBe(false);
      expect(h.state.editingTextElement).toBe(null);

      // and the same goes for Space, which would pan the board
      const space = createEvent.keyDown(option, { key: " " });
      fireEvent(option, space);

      expect(space.defaultPrevented).toBe(false);
    });

    it("does not accept votes once the poll is closed", async () => {
      await render(<Excalidraw />);

      const pollOptions = await createPollCard();

      fireEvent.click(pollOptions[0] as HTMLButtonElement);

      // the card is selected, so it has its actions
      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-poll-close"]',
        )!,
      );

      const closedOptions = document.querySelectorAll<HTMLButtonElement>(
        '[data-testid="facilitation-poll-option"]',
      );

      expect(closedOptions[0].disabled).toBe(true);

      // a closed poll keeps the votes it has, and takes no new one
      fireEvent.click(closedOptions[0]);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="facilitation-poll-option"]')
            ?.textContent,
        ).toContain("100%");
      });

      const poll = getPollData(h.elements[0]);
      const store = getFacilitationStore();
      expect(Object.values(store.pollVotes[poll!.id])).toHaveLength(1);
    });

    it("takes the votes back, and deletes the card", async () => {
      await render(<Excalidraw />);

      const pollOptions = await createPollCard();

      fireEvent.click(pollOptions[0] as HTMLButtonElement);

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-poll-reset"]',
        )!,
      );

      const poll = getPollData(h.elements[0]);
      expect(
        Object.values(getFacilitationStore().pollVotes[poll!.id]),
      ).toHaveLength(0);

      // the card is gone from the board, and so is its widget
      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="facilitation-poll-delete"]',
        )!,
      );

      expect(h.elements).toHaveLength(0);
      expect(
        document.querySelector('[data-testid="facilitation-poll-card"]'),
      ).toBe(null);
    });
  });
});
