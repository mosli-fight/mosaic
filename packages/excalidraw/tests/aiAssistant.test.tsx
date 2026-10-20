import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";
import { vi } from "vitest";

import { Excalidraw } from "../index";
import { closeAIPanel } from "../components/ai/aiPanelStore";
import { AI_SETTINGS_STORAGE_KEY } from "../components/ai/storage";

import { act, render } from "./test-utils";

const { h } = window;

/**
 * The assistant panel, from the toolbar to the board.
 *
 * The panel is a bring-your-own-key affair: until the user says which
 * provider to talk to, there is nothing to say to a model, so the panel
 * asks for a provider first. What the user types there never leaves their
 * browser except as the `Authorization` header of a request to the url
 * they set.
 */

const getByTestId = (container: HTMLElement, testId: string) =>
  container.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

const mockFetch = vi.fn();

/** the provider answered with something */
const answerWith = (content: string) => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    headers: { get: () => "application/json" },
    text: async () => JSON.stringify({ choices: [{ message: { content } }] }),
  });
};

/** opens the panel and tells it which provider to talk to */
const setupAssistant = async (container: HTMLElement) => {
  act(() => {
    fireEvent.click(getByTestId(container, "toolbar-ai")!);
  });

  await waitFor(() => {
    expect(getByTestId(container, "ai-settings-form")).not.toBe(null);
  });

  fireEvent.change(getByTestId(container, "ai-base-url")!, {
    target: { value: "https://api.openai.com/v1" },
  });
  fireEvent.change(getByTestId(container, "ai-api-key")!, {
    target: { value: "sk-test-key" },
  });
  fireEvent.change(getByTestId(container, "ai-model")!, {
    target: { value: "gpt-4o-mini" },
  });
  fireEvent.click(getByTestId(container, "ai-save")!);

  await waitFor(() => {
    expect(getByTestId(container, "ai-messages")).not.toBe(null);
  });
};

describe("the AI assistant", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      closeAIPanel();
    });
    localStorage.clear();
  });

  it("opens from the toolbar", async () => {
    const { container } = await render(<Excalidraw />);

    expect(getByTestId(container, "ai-panel")).toBe(null);

    act(() => {
      fireEvent.click(getByTestId(container, "toolbar-ai")!);
    });

    await waitFor(() => {
      expect(getByTestId(container, "ai-panel")).not.toBe(null);
    });
  });

  it("asks for a provider before it talks to one", async () => {
    const { container } = await render(<Excalidraw />);

    act(() => {
      fireEvent.click(getByTestId(container, "toolbar-ai")!);
    });

    await waitFor(() => {
      expect(getByTestId(container, "ai-settings-form")).not.toBe(null);
    });

    // the key is a password field, so it is never on the screen
    expect(getByTestId(container, "ai-api-key")?.getAttribute("type")).toBe(
      "password",
    );
  });

  it("keeps the settings in this browser, and nowhere else", async () => {
    const { container } = await render(<Excalidraw />);

    act(() => {
      fireEvent.click(getByTestId(container, "toolbar-ai")!);
    });

    await waitFor(() => {
      expect(getByTestId(container, "ai-settings-form")).not.toBe(null);
    });

    fireEvent.change(getByTestId(container, "ai-base-url")!, {
      target: { value: "https://api.openai.com/v1" },
    });
    fireEvent.change(getByTestId(container, "ai-api-key")!, {
      target: { value: "sk-test-key" },
    });
    fireEvent.change(getByTestId(container, "ai-model")!, {
      target: { value: "gpt-4o-mini" },
    });
    fireEvent.click(getByTestId(container, "ai-save")!);

    await waitFor(() => {
      expect(getByTestId(container, "ai-messages")).not.toBe(null);
    });

    expect(
      JSON.parse(localStorage.getItem(AI_SETTINGS_STORAGE_KEY) as string),
    ).toEqual({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test-key",
      model: "gpt-4o-mini",
    });
  });
});

describe("talking to the provider", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      closeAIPanel();
    });
    localStorage.clear();
  });

  it("asks the provider the user chose, and nobody else", async () => {
    answerWith("It is a board about cats.");

    const { container } = await render(<Excalidraw />);
    await setupAssistant(container);

    fireEvent.change(getByTestId(container, "ai-input")!, {
      target: { value: "What is this board about?" },
    });
    fireEvent.click(getByTestId(container, "ai-send")!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const [url, request] = mockFetch.mock.calls[0];

    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer sk-test-key");
    expect(request.body).toContain("gpt-4o-mini");
    expect(request.body).toContain("What is this board about?");

    await waitFor(() => {
      expect(container.textContent).toContain("It is a board about cats.");
    });
  });

  it("keeps the key out of the board", async () => {
    answerWith("Nothing to add.");

    const { container } = await render(<Excalidraw />);
    await setupAssistant(container);

    fireEvent.change(getByTestId(container, "ai-input")!, {
      target: { value: "Hello" },
    });
    fireEvent.click(getByTestId(container, "ai-send")!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    expect(
      JSON.stringify(h.app.scene.getElementsIncludingDeleted()),
    ).not.toContain("sk-test-key");
  });
});

describe("drawing from what the model says", () => {
  beforeEach(() => {
    localStorage.clear();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    act(() => {
      closeAIPanel();
    });
    localStorage.clear();
  });

  it("puts the diagram on the board", async () => {
    answerWith(
      JSON.stringify([
        {
          type: "rectangle",
          x: 0,
          y: 0,
          width: 200,
          height: 100,
          text: "Start",
        },
        { type: "arrow", x: 100, y: 100, x2: 100, y2: 200 },
        { type: "ellipse", x: 20, y: 200, width: 160, height: 80, text: "End" },
      ]),
    );

    const { container } = await render(<Excalidraw />);
    await setupAssistant(container);

    fireEvent.change(getByTestId(container, "ai-input")!, {
      target: { value: "A flowchart of a login" },
    });
    fireEvent.click(getByTestId(container, "ai-generate")!);

    await waitFor(() => {
      expect(h.elements.length).toBeGreaterThan(0);
    });

    const types = h.elements.map((element) => element.type);

    expect(types).toContain("rectangle");
    expect(types).toContain("arrow");
    expect(types).toContain("ellipse");
  });

  it("shows the answer it could not use, rather than losing it", async () => {
    answerWith("I am afraid I cannot draw that.");

    const { container } = await render(<Excalidraw />);
    await setupAssistant(container);

    fireEvent.change(getByTestId(container, "ai-input")!, {
      target: { value: "A flowchart of a login" },
    });
    fireEvent.click(getByTestId(container, "ai-generate")!);

    await waitFor(() => {
      expect(container.textContent).toContain(
        "I am afraid I cannot draw that.",
      );
    });

    expect(h.elements.length).toBe(0);
  });
});
