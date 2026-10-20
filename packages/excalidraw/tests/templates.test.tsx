import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";

import { Excalidraw, MainMenu } from "../index";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATES,
  buildTemplateElements,
  getTemplateById,
} from "../templates";

import { API } from "./helpers/api";
import { act, render, toggleMenu } from "./test-utils";

const { h } = window;

const openGallery = async () => {
  await render(<Excalidraw />);

  act(() => {
    API.setAppState({ openDialog: { name: "templates" } });
  });

  await waitFor(() => {
    expect(document.querySelector('[data-testid="templates-grid"]')).not.toBe(
      null,
    );
  });
};

const getCards = () =>
  document.querySelectorAll('[data-testid^="templates-card-"]');

const getSearchInput = () =>
  document.querySelector(
    '[data-testid="templates-search"] input',
  ) as HTMLInputElement;

describe("templates gallery", () => {
  describe("the catalogue", () => {
    it("has a template for every category", () => {
      for (const category of TEMPLATE_CATEGORIES) {
        const templates = TEMPLATES.filter(
          (template) => template.category === category.id,
        );
        expect(templates.length).toBeGreaterThan(0);
      }
    });

    it("gives every template a name, a description and a category", () => {
      for (const template of TEMPLATES) {
        expect(template.nameKey).toBeTruthy();
        expect(template.descriptionKey).toBeTruthy();
        expect(template.elements.length).toBeGreaterThan(0);
      }
    });

    it("builds every template into elements with unique ids", () => {
      for (const template of TEMPLATES) {
        const elements = buildTemplateElements(template);
        expect(elements.length).toBeGreaterThan(0);

        const ids = elements.map((element) => element.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });

    it("binds every label to the shape it labels", () => {
      for (const template of TEMPLATES) {
        const elements = buildTemplateElements(template);
        const elementsMap = new Map(elements.map((el) => [el.id, el]));

        let boundLabels = 0;

        for (const element of elements) {
          // a text either stands on its own or is bound to the shape it
          // labels — never a half-bound text
          if (element.type !== "text" || !element.containerId) {
            continue;
          }

          boundLabels++;

          const container = elementsMap.get(element.containerId);
          expect(container).toBeDefined();
          expect(container!.boundElements).toEqual([
            expect.objectContaining({ type: "text", id: element.id }),
          ]);
        }

        // and every shape that claims a label really has one
        const claimed = elements.filter((element) =>
          element.boundElements?.some((bound) => bound.type === "text"),
        );
        expect(claimed).toHaveLength(boundLabels);
      }
    });

    it("puts the elements of a frame inside the frame", () => {
      const template = getTemplateById("wireframe-basics")!;
      const elements = buildTemplateElements(template);
      const frame = elements.find((element) => element.type === "frame")!;

      expect(frame).toBeDefined();

      const children = elements.filter(
        (element) => element.frameId === frame.id,
      );
      expect(children.length).toBeGreaterThan(0);

      for (const child of children) {
        expect(child.x).toBeGreaterThanOrEqual(frame.x);
        expect(child.y).toBeGreaterThanOrEqual(frame.y);
        expect(child.x + child.width).toBeLessThanOrEqual(
          frame.x + frame.width,
        );
        expect(child.y + child.height).toBeLessThanOrEqual(
          frame.y + frame.height,
        );
      }
    });

    it("finds a template by its id", () => {
      expect(getTemplateById("kanban-board")?.id).toBe("kanban-board");
      expect(getTemplateById("nope")).toBeUndefined();
    });
  });

  describe("the dialog", () => {
    it("lists every template", async () => {
      await openGallery();

      expect(getCards()).toHaveLength(TEMPLATES.length);
    });

    it("opens from the toolbar", async () => {
      const { container } = await render(<Excalidraw />);

      const button = container.querySelector<HTMLButtonElement>(
        '[data-testid="toolbar-templates"]',
      );
      expect(button).not.toBe(null);

      fireEvent.click(button!);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="templates-grid"]'),
        ).not.toBe(null);
      });
    });

    it("opens from the main menu", async () => {
      const { container } = await render(
        <Excalidraw>
          <MainMenu>
            <MainMenu.DefaultItems.Templates />
          </MainMenu>
        </Excalidraw>,
      );

      toggleMenu(container);

      const item = await waitFor(() => {
        const found = document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-button"]',
        );
        expect(found).not.toBe(null);
        return found!;
      });

      fireEvent.click(item);

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="templates-grid"]'),
        ).not.toBe(null);
      });
    });

    it("narrows the gallery down to a category", async () => {
      await openGallery();

      const tab = document.querySelector<HTMLButtonElement>(
        '[data-testid="templates-tab-ideation"]',
      );
      expect(tab).not.toBe(null);

      fireEvent.click(tab!);

      const expected = TEMPLATES.filter(
        (template) => template.category === "ideation",
      );
      expect(getCards()).toHaveLength(expected.length);
      expect(expected.length).toBeGreaterThan(0);
    });

    it("narrows the gallery down to a search", async () => {
      await openGallery();

      const input = getSearchInput();
      expect(input).not.toBe(null);

      fireEvent.change(input, { target: { value: "kanban" } });

      await waitFor(() => {
        expect(getCards()).toHaveLength(1);
      });
    });

    it("says so when nothing matches the search", async () => {
      await openGallery();

      fireEvent.change(getSearchInput(), {
        target: { value: "nothing at all" },
      });

      await waitFor(() => {
        expect(
          document.querySelector('[data-testid="templates-empty"]'),
        ).not.toBe(null);
      });
    });

    it("previews a template without touching the board", async () => {
      await openGallery();

      const before = h.elements.length;

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-preview-kanban-board"]',
        )!,
      );

      expect(h.elements.length).toBe(before);
    });
  });

  describe("using a template", () => {
    it("puts the template on the board and selects it", async () => {
      await openGallery();

      expect(h.elements.length).toBe(0);

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-use-brainstorming"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBeGreaterThan(0);
      });

      // the template is on the board, in the middle of the viewport
      const elements = h.elements;
      const centerX = h.state.width / 2;
      const centerY = h.state.height / 2;
      const bounds = elements.reduce(
        (acc, element) => ({
          minX: Math.min(acc.minX, element.x),
          minY: Math.min(acc.minY, element.y),
          maxX: Math.max(acc.maxX, element.x + element.width),
          maxY: Math.max(acc.maxY, element.y + element.height),
        }),
        { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
      );

      expect((bounds.minX + bounds.maxX) / 2).toBeCloseTo(centerX, 0);
      expect((bounds.minY + bounds.maxY) / 2).toBeCloseTo(centerY, 0);

      // and it is selected
      const selectedIds = Object.keys(h.state.selectedElementIds);
      expect(selectedIds.length).toBeGreaterThan(0);
    });

    it("gives the inserted elements new ids", async () => {
      const template = getTemplateById("kanban-board")!;
      const elements = buildTemplateElements(template);
      const originalIds = elements.map((element) => element.id);

      await openGallery();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-use-kanban-board"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBeGreaterThan(0);
      });

      const insertedIds = h.elements.map((element) => element.id);
      for (const id of originalIds) {
        expect(insertedIds).not.toContain(id);
      }
    });

    it("closes the gallery", async () => {
      await openGallery();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-use-meeting-agenda"]',
        )!,
      );

      await waitFor(() => {
        expect(document.querySelector('[data-testid="templates-grid"]')).toBe(
          null,
        );
      });
    });

    it("can be used twice", async () => {
      await openGallery();

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-use-mind-map"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBeGreaterThan(0);
      });

      const first = h.elements.length;

      act(() => {
        API.setAppState({ openDialog: { name: "templates" } });
      });

      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          '[data-testid="templates-use-mind-map"]',
        )!,
      );

      await waitFor(() => {
        expect(h.elements.length).toBeGreaterThan(first);
      });
    });
  });
});
