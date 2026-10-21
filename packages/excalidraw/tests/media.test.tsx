import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { isImageElement } from "@excalidraw/element";

import type { ExcalidrawTextElement } from "@excalidraw/element/types";

import { Excalidraw, MainMenu } from "../index";
import {
  EMOJI_CATEGORIES,
  EMOJIS,
  getEmojiCount,
  searchEmojis,
} from "../components/media/emojiData";
import { GIF_SETTINGS_STORAGE_KEY } from "../components/media/gifSettings";
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

const getGifSearchInput = () =>
  document.querySelector(
    '[data-testid="media-gif-search"] input',
  ) as HTMLInputElement;

const getGifKeyInput = () =>
  document.querySelector(
    '[data-testid="media-gif-api-key"]',
  ) as HTMLInputElement;

/** what the provider answers with */
const GIF_RESULTS = [
  {
    id: "dancing-cat",
    title: "A dancing cat",
    images: {
      fixed_width: {
        url: "https://media.giphy.com/media/dancing-cat/200w.gif",
        width: 200,
        height: 112,
      },
      preview_gif: {
        url: "https://media.giphy.com/media/dancing-cat/giphy-preview.gif",
        width: 100,
        height: 56,
      },
    },
  },
];

const mockFetch = vi.fn();

/** the provider answers with GIFs, and the GIFs themselves can be fetched */
const answerWithGifs = () => {
  mockFetch.mockImplementation(async (url: string) => {
    if (url.includes("api.giphy.com")) {
      return {
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ data: GIF_RESULTS }),
      };
    }

    return {
      ok: true,
      status: 200,
      headers: { get: () => "image/gif" },
      arrayBuffer: async () =>
        new TextEncoder().encode("GIF89a-the-animated-bytes").buffer,
    };
  });
};

const openGifTab = async () => {
  await openPanel();

  fireEvent.click(
    document.querySelector<HTMLButtonElement>('[data-testid="media-tab-gif"]')!,
  );

  await waitFor(() => {
    expect(document.querySelector('[data-testid="media-tab-gif"]')).not.toBe(
      null,
    );
  });
};

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

  describe("the GIFs", () => {
    beforeEach(() => {
      localStorage.clear();
      mockFetch.mockReset();
      global.fetch = mockFetch as unknown as typeof fetch;
    });

    afterEach(() => {
      localStorage.clear();
    });

    const withKey = (apiKey = "test-key") => {
      localStorage.setItem(
        GIF_SETTINGS_STORAGE_KEY,
        JSON.stringify({ apiKey }),
      );
    };

    it("has a tab of its own", async () => {
      await openPanel();

      expect(document.querySelector('[data-testid="media-tab-gif"]')).not.toBe(
        null,
      );
    });

    it("asks for a key before it searches for anything", async () => {
      await openGifTab();

      expect(
        document.querySelector('[data-testid="media-gif-setup"]'),
      ).not.toBe(null);

      // no key, no search — and no wall of errors either
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("keeps the key in this browser, and nowhere else", async () => {
      await openGifTab();

      fireEvent.change(getGifKeyInput(), {
        target: { value: "test-key" },
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-gif-save"]',
        )!,
      );

      await waitFor(() => {
        expect(
          JSON.parse(localStorage.getItem(GIF_SETTINGS_STORAGE_KEY) as string),
        ).toEqual({ apiKey: "test-key" });
      });

      // and the setup step steps out of the way
      expect(document.querySelector('[data-testid="media-gif-setup"]')).toBe(
        null,
      );
    });

    it("searches with the key the user gave it", async () => {
      answerWithGifs();
      withKey();

      await openGifTab();

      fireEvent.change(getGifSearchInput(), {
        target: { value: "cat" },
      });

      await waitFor(
        () => {
          expect(mockFetch).toHaveBeenCalled();
        },
        { timeout: 3000 },
      );

      const [url] = mockFetch.mock.calls[0];

      expect(url).toContain("api_key=test-key");
      expect(url).toContain("q=cat");
    });

    it("shows the GIFs it found", async () => {
      answerWithGifs();
      withKey();

      await openGifTab();

      fireEvent.change(getGifSearchInput(), {
        target: { value: "cat" },
      });

      await waitFor(
        () => {
          expect(
            document.querySelector('[data-testid="media-gif-dancing-cat"]'),
          ).not.toBe(null);
        },
        { timeout: 3000 },
      );
    });

    it("says so when the search fails", async () => {
      mockFetch.mockRejectedValue(new Error("the network is down"));
      withKey();

      await openGifTab();

      fireEvent.change(getGifSearchInput(), {
        target: { value: "cat" },
      });

      await waitFor(
        () => {
          expect(
            document.querySelector('[data-testid="media-gif-error"]'),
          ).not.toBe(null);
        },
        { timeout: 3000 },
      );
    });

    it("puts a GIF on the board with the animated file itself", async () => {
      answerWithGifs();
      withKey();

      await openGifTab();

      fireEvent.change(getGifSearchInput(), {
        target: { value: "cat" },
      });

      await waitFor(
        () => {
          expect(
            document.querySelector('[data-testid="media-gif-dancing-cat"]'),
          ).not.toBe(null);
        },
        { timeout: 3000 },
      );

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="media-gif-dancing-cat"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBe(1);
      });

      const element = h.elements[0];

      expect(element.type).toBe("image");
      expect(isImageElement(element)).toBe(true);

      if (!isImageElement(element)) {
        throw new Error("the GIF did not land as an image");
      }

      // the file is the animated GIF, kept as it is — not a still of it
      const file = h.app.files[element.fileId!];

      expect(file).toBeDefined();
      expect(file.mimeType).toBe("image/gif");
      expect(file.dataURL.startsWith("data:image/gif;base64,")).toBe(true);

      // and it keeps the proportions it was made in
      expect(element.width).toBe(200);
      expect(element.height).toBe(112);
    });
  });
});
