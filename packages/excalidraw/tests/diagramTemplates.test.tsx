import React from "react";

import { fireEvent, waitFor } from "@testing-library/react";

import { Excalidraw } from "../index";
import { t } from "../i18n";
import { buildTemplateElements } from "../templates";
import { TEMPLATES } from "../templates/catalogue";
import { DIAGRAM_TEMPLATES } from "../templates/diagrams";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

import type { ExcalidrawElement } from "@excalidraw/element/types";

const { h } = window;

const openGallery = async () => {
  await render(<Excalidraw />);

  act(() => {
    API.setAppState({ openDialog: { name: "templates" } });
  });

  await waitFor(() => {
    expect(
      document.querySelectorAll('[data-testid^="templates-card-"]'),
    ).toHaveLength(TEMPLATES.length + DIAGRAM_TEMPLATES.length);
  });
};

/** the shapes a connector can be bound to */
const isBindableShape = (element: ExcalidrawElement) =>
  element.type === "rectangle" ||
  element.type === "ellipse" ||
  element.type === "diamond";

describe("the diagram catalogue", () => {
  it("carries sixty diagrams or more", () => {
    expect(DIAGRAM_TEMPLATES.length).toBeGreaterThanOrEqual(60);
  });

  it("keeps the original templates first and untouched", () => {
    const ids = DIAGRAM_TEMPLATES.map((template) => template.id);
    const originalIds = new Set(TEMPLATES.map((template) => template.id));

    for (const id of ids) {
      expect(originalIds.has(id)).toBe(false);
    }

    // and the originals are still the head of the gallery
    expect(TEMPLATES[0].id).toBe("brainstorming");
  });

  it("gives every diagram a unique id", () => {
    const ids = DIAGRAM_TEMPLATES.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("gives every diagram a name and a description in the language of the gallery", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      expect(t(template.nameKey)).toBeTruthy();
      expect(t(template.descriptionKey)).toBeTruthy();
      // an untranslated key comes back as the key itself
      expect(t(template.nameKey)).not.toBe(template.nameKey);
      expect(t(template.descriptionKey)).not.toBe(template.descriptionKey);
    }
  });

  it("gives every diagram a heading and some content", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      const elements = buildTemplateElements(template);

      expect(elements.length).toBeGreaterThan(2);

      const texts = elements.filter((element) => element.type === "text");
      expect(texts.length).toBeGreaterThan(0);
    }
  });

  it("gives every diagram at least one shape and one arrow", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      const elements = buildTemplateElements(template);

      expect(elements.some(isBindableShape)).toBe(true);
      expect(elements.some((element) => element.type === "arrow")).toBe(true);
    }
  });

  it("puts every element inside the diagram's bounds", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      for (const element of buildTemplateElements(template)) {
        expect(Number.isFinite(element.x)).toBe(true);
        expect(Number.isFinite(element.y)).toBe(true);

        // an arrow is measured by its points, not by its box: a lifeline is
        // a straight vertical line and has no width
        if (element.type === "arrow") {
          continue;
        }

        expect(element.width).toBeGreaterThan(0);
        expect(element.height).toBeGreaterThan(0);
      }
    }
  });

  it("binds every connector to the two shapes it joins", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      const elements = buildTemplateElements(template);
      const byId = new Map(elements.map((element) => [element.id, element]));

      for (const arrow of elements) {
        if (arrow.type !== "arrow" || !arrow.startBinding) {
          continue;
        }

        // a diagram's arrow is bound at both ends, to shapes that exist
        expect(arrow.endBinding).not.toBeNull();

        const from = byId.get(arrow.startBinding.elementId);
        const to = byId.get(arrow.endBinding!.elementId);

        expect(from).toBeDefined();
        expect(to).toBeDefined();
        expect(isBindableShape(from!)).toBe(true);
        expect(isBindableShape(to!)).toBe(true);

        // and each shape knows the arrow, so moving one moves the arrow
        expect(from!.boundElements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "arrow", id: arrow.id }),
          ]),
        );
        expect(to!.boundElements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "arrow", id: arrow.id }),
          ]),
        );
      }
    }
  });

  it("gives every diagram with a connector at least one bound arrow", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      const connectors = template.elements.filter(
        (spec) => spec.kind === "connector",
      );

      // a sequence diagram draws its messages as plain arrows between
      // lifelines rather than as connectors between shapes
      if (!connectors.length) {
        continue;
      }

      const elements = buildTemplateElements(template);
      const boundArrows = elements.filter(
        (element) => element.type === "arrow" && element.startBinding,
      );

      expect(boundArrows.length).toBeGreaterThan(0);
    }
  });

  it("binds every arrow label to the arrow it is written on", () => {
    for (const template of DIAGRAM_TEMPLATES) {
      const elements = buildTemplateElements(template);
      const byId = new Map(elements.map((element) => [element.id, element]));

      for (const element of elements) {
        if (element.type !== "text" || !element.containerId) {
          continue;
        }

        const container = byId.get(element.containerId);
        expect(container).toBeDefined();
        expect(container!.boundElements).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ type: "text", id: element.id }),
          ]),
        );
      }
    }
  });

  it("gives every diagram a category the gallery knows", async () => {
    await openGallery();

    for (const template of DIAGRAM_TEMPLATES) {
      const tab = document.querySelector(
        `[data-testid="templates-tab-${template.category}"]`,
      );
      expect(tab).not.toBe(null);
    }
  });

  it("narrows the gallery down to the diagram categories", async () => {
    await openGallery();

    for (const category of ["data", "software", "process", "systems"]) {
      fireEvent.click(
        document.querySelector<HTMLButtonElement>(
          `[data-testid="templates-tab-${category}"]`,
        )!,
      );

      const expected = DIAGRAM_TEMPLATES.filter(
        (template) => template.category === category,
      );
      expect(expected.length).toBeGreaterThan(0);
      expect(
        document.querySelectorAll('[data-testid^="templates-card-"]'),
      ).toHaveLength(expected.length);
    }
  });

  it("finds a diagram by its name", async () => {
    await openGallery();

    fireEvent.change(
      document.querySelector<HTMLInputElement>(
        '[data-testid="templates-search"] input',
      )!,
      { target: { value: "star schema" } },
    );

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="templates-card-erd-star-schema"]'),
      ).not.toBe(null);
    });
  });

  it("puts a diagram on the board with its arrows attached", async () => {
    await openGallery();

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="templates-use-erd-blog"]',
      )!,
    );

    await waitFor(() => {
      expect(h.elements.length).toBeGreaterThan(0);
    });

    const byId = new Map(h.elements.map((element) => [element.id, element]));
    const arrows = h.elements.filter((element) => element.type === "arrow");

    expect(arrows.length).toBeGreaterThan(0);

    for (const arrow of arrows) {
      expect(arrow.startBinding).not.toBeNull();
      expect(arrow.endBinding).not.toBeNull();

      // the bindings name elements that are on the board, not the template's
      // own ids
      expect(byId.get(arrow.startBinding!.elementId)).toBeDefined();
      expect(byId.get(arrow.endBinding!.elementId)).toBeDefined();
    }
  });

  it("puts a sequence diagram on the board", async () => {
    await openGallery();

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="templates-use-seq-login"]',
      )!,
    );

    await waitFor(() => {
      expect(h.elements.length).toBeGreaterThan(0);
    });

    const participants = h.elements.filter(
      (element) => element.type === "rectangle",
    );
    const messages = h.elements.filter((element) => element.type === "arrow");

    expect(participants.length).toBe(3);
    expect(messages.length).toBeGreaterThanOrEqual(5);
  });
});
