import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";

import { isImageElement } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw, MainMenu } from "../index";
import {
  EMOJI_CATEGORIES,
  EMOJIS,
  getEmojiCount,
  searchEmojis,
} from "../components/media/emojiData";
import {
  STICKERS,
  stickerToDataURL,
  stickerToSVG,
} from "../components/media/stickers";

import { API } from "./helpers/api";
import { act, render, toggleMenu } from "./test-utils";

const { h } = window;

const openPanel = async () => {
  await render(<Excalidraw />);

  act(() => {
    API.setAppState({ openDialog: { name: "media" } });
  });

  await waitFor(() => {
    expect(document.querySelector('[data-testid="media-tab-emoji"]')).not.toBe(
      null,
    );
  });
};

const getEmojiButtons = () =>
  document.querySelectorAll('[data-testid^="media-emoji-"]');

const getStickerButtons = () =>
  document.querySelectorAll('[data-testid^="media-sticker-"]');

const getSearchInput = () =>
  document.querySelector(
    '[data-testid="media-panel-search"] input',
  ) as HTMLInputElement;

const getVideoInput = () =>
  document.querySelector(
    '[data-testid="media-video-field"] input',
  ) as HTMLInputElement;

describe("media panel", () => {
  describe("the emoji catalogue", () => {
    it("has emoji in every category", () => {
      for (const category of EMOJI_CATEGORIES) {
        expect(EMOJIS[category.id].length).toBeGreaterThan(0);
      }
    });

    it("gives every emoji a character and a name", () => {
      for (const category of EMOJI_CATEGORIES) {
        for (const entry of EMOJIS[category.id]) {
          expect(entry.char.length).toBeGreaterThan(0);
          expect(entry.name.length).toBeGreaterThan(0);
        }
      }
    });

    it("counts every emoji it offers", () => {
      expect(getEmojiCount()).toBe(
        EMOJI_CATEGORIES.reduce(
          (count, category) => count + EMOJIS[category.id].length,
          0,
        ),
      );
    });

    it("finds an emoji by its name", () => {
      const groups = searchEmojis("cake");

      expect(groups.length).toBeGreaterThan(0);
      expect(
        groups.some((group) =>
          group.entries.some((entry) => entry.name.includes("cake")),
        ),
      ).toBe(true);
    });

    it("finds an emoji by the emoji itself", () => {
      const groups = searchEmojis("🍰");

      expect(groups.length).toBe(1);
      expect(groups[0].entries.length).toBe(1);
    });

    it("drops the categories that have nothing to show", () => {
      const groups = searchEmojis("zzzzzz");

      expect(groups).toHaveLength(0);
    });

    it("returns everything when nothing is searched for", () => {
      expect(searchEmojis("")).toHaveLength(EMOJI_CATEGORIES.length);
    });
  });

  describe("the stickers", () => {
    it("gives every sticker its own id", () => {
      const ids = STICKERS.map((sticker) => sticker.id);

      expect(new Set(ids).size).toBe(ids.length);
    });

    it("draws every sticker on a canvas of a known size", () => {
      for (const sticker of STICKERS) {
        const svg = stickerToSVG(sticker);

        expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
        expect(svg).toContain('width="100"');
        expect(svg).toContain('height="100"');
        expect(svg).toContain('viewBox="0 0 100 100"');
      }
    });

    it("encodes every sticker as a base64 svg", () => {
      for (const sticker of STICKERS) {
        const dataURL = stickerToDataURL(sticker);

        expect(dataURL.startsWith("data:image/svg+xml;base64,")).toBe(true);
        expect(dataURL.length).toBeGreaterThan(64);
      }
    });
  });

  describe("the panel", () => {
    it("opens from the toolbar", async () => {
      const { container } = await render(<Excalidraw />);

      const button = container.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-media"]',
      );
      expect(button).not.toBe(null);

      fireEvent.click(button!);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="media-tab-emoji"]'),
        ).not.toBe(null);
      });
    });

    it("opens from the main menu", async () => {
      const { container } = await render(
        <Excalidraw>
          <MainMenu>
            <MainMenu.DefaultItems.Media />
          </MainMenu>
        </Excalidraw>,
      );

      toggleMenu(container);

      const item = await waitFor(() => {
        const found = document.querySelector<HTMLButtonElement>(
          '[data-testid="media-button"]',
        );
        expect(found).not.toBe(null);
        return found!;
      });

      fireEvent.click(item);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="media-tab-emoji"]'),
        ).not.toBe(null);
      });
    });

    it("lists the emoji", async () => {
      await openPanel();

      expect(getEmojiButtons().length).toBeGreaterThan(0);
    });

    it("narrows the emoji down to a search", async () => {
      await openPanel();

      fireEvent.change(getSearchInput(), {
        target: { value: "cupcake" },
      });

      await waitFor(() => {
        expect(getEmojiButtons().length).toBe(1);
      });
    });

    it("says so when no emoji matches the search", async () => {
      await openPanel();

      fireEvent.change(getSearchInput(), {
        target: { value: "nothing at all" },
      });

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="media-emoji-empty"]'),
        ).not.toBe(null);
      });
    });

    it("shows the stickers on the other tab", async () => {
      await openPanel();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-tab-stickers"]',
        )!,
      );

      await waitFor(() => {
        expect(getStickerButtons()).toHaveLength(STICKERS.length);
      });
    });
  });

  describe("adding media", () => {
    it("puts an emoji on the board as text", async () => {
      await openPanel();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-emoji-grinning"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      const element = h.elements[0] as ExcalidrawTextElement;

      expect(element.type).toBe("text");
      expect(element.text).toBe("😀");
      // big enough to be a sticker of its own
      expect(element.fontSize).toBeGreaterThan(20);

      // and it comes back selected, ready to be dragged around
      expect(Object.keys(h.state.selectedElementIds)).toHaveLength(1);
    });

    it("puts an emoji in the middle of the viewport", async () => {
      await openPanel();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-emoji-grinning"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      const element = h.elements[0];
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;

      expect(centerX).toBeCloseTo(h.state.width / 2, 0);
      expect(centerY).toBeCloseTo(h.state.height / 2, 0);
    });

    it("puts a sticker on the board as an image with a file", async () => {
      await openPanel();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-tab-stickers"]',
        )!,
      );

      await waitFor(() => {
        expect(getStickerButtons()).toHaveLength(STICKERS.length);
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-sticker-star"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      const element = h.elements[0];

      expect(element.type).toBe("image");
      expect(isImageElement(element)).toBe(true);

      if (!isImageElement(element)) {
        throw new Error("the sticker did not land as an image");
      }

      expect(element.fileId).toBeTruthy();

      // the drawing of the sticker travels with the element
      const file = h.app.files[element.fileId!];

      expect(file).toBeDefined();
      expect(file.mimeType).toBe("image/svg+xml");
      expect(file.dataURL.startsWith("data:image/svg+xml;base64,")).toBe(true);
    });

    it("keeps the panel open so that more can be added", async () => {
      await openPanel();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-emoji-grinning"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      expect(
        document.querySelector('[data-testid="media-tab-emoji"]'),
      ).not.toBe(null);
    });
  });

  describe("adding a video", () => {
    const openVideoForm = async () => {
      await openPanel();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-add-video"]',
        )!,
      );

      await waitFor(() => {
        expect(getVideoInput()).not.toBe(null);
      });
    };

    it("puts a YouTube video on the board as an embeddable", async () => {
      await openVideoForm();

      fireEvent.change(getVideoInput(), {
        target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-video-submit"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      const element = h.elements[0];

      expect(element.type).toBe("embeddable");
      expect(element.link).toBe("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    });

    it("puts a Vimeo video on the board as an embeddable", async () => {
      await openVideoForm();

      fireEvent.change(getVideoInput(), {
        target: { value: "https://vimeo.com/76979871" },
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-video-submit"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      expect(h.elements[0].type).toBe("embeddable");
    });

    it("refuses a link that is not a video", async () => {
      await openVideoForm();

      fireEvent.change(getVideoInput(), {
        target: { value: "https://www.figma.com/file/abcdef" },
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-video-submit"]',
        )!,
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="media-video-error"]'),
        ).not.toBe(null);
      });

      expect(h.elements.length).toBe(0);
    });

    it("refuses a link it cannot embed at all", async () => {
      await openVideoForm();

      fireEvent.change(getVideoInput(), {
        target: { value: "https://example.com/some-page" },
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-video-submit"]',
        )!,
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="media-video-error"]'),
        ).not.toBe(null);
      });

      expect(h.elements.length).toBe(0);
    });

    it("goes back to the media", async () => {
      await openVideoForm();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-video-back"]',
        )!,
      );

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="media-tab-emoji"]'),
        ).not.toBe(null);
      });
    });
  });
});
