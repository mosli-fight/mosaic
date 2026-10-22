import { fireEvent, waitFor } from "@testing-library/react";
import React from "react";

import { isImageElement } from "@excalidraw/element";

import { Excalidraw } from "../index";
import {
  findIconById,
  findIconByName,
  getIconCount,
  ICON_CATEGORIES,
  ICONS,
  iconToDataURL,
  iconToSVG,
  searchIcons,
} from "../components/icons/icons";
import { insertIcon } from "../components/media/insertMedia";

import { API } from "./helpers/api";
import { act, render } from "./test-utils";

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

const openIconsTab = async () => {
  await openPanel();

  fireEvent.click(
    document.querySelector<HTMLButtonElement>(
      '[data-testid="media-tab-icons"]',
    )!,
  );

  await waitFor(() => {
    expect(getIconButtons()).toHaveLength(ICONS.length);
  });
};

const getIconButtons = () =>
  document.querySelectorAll('[data-testid^="media-icon-"]');

const getIconSearchInput = () =>
  document.querySelector(
    '[data-testid="media-icons-search"] input',
  ) as HTMLInputElement;

const getIconCategoryButton = (id: string) =>
  document.querySelector<HTMLButtonElement>(
    `[data-testid="media-icons-category-${id}"]`,
  );

describe("the icon catalogue", () => {
  it("gives every icon its own id", () => {
    const ids = ICONS.map((icon) => icon.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers a decent number of icons", () => {
    expect(getIconCount()).toBe(ICONS.length);
    expect(getIconCount()).toBeGreaterThanOrEqual(40);
    expect(getIconCount()).toBeLessThanOrEqual(120);
  });

  it("draws every icon on a canvas of a known size", () => {
    for (const icon of ICONS) {
      const svg = iconToSVG(icon);

      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      expect(svg).toContain('width="100"');
      expect(svg).toContain('height="100"');
      expect(svg).toContain('viewBox="0 0 100 100"');
    }
  });

  it("encodes every icon as a base64 svg", () => {
    for (const icon of ICONS) {
      const dataURL = iconToDataURL(icon);

      expect(dataURL.startsWith("data:image/svg+xml;base64,")).toBe(true);
      expect(dataURL.length).toBeGreaterThan(64);
    }
  });

  it("gives every icon a name", () => {
    for (const icon of ICONS) {
      expect(icon.name.length).toBeGreaterThan(0);
    }
  });

  it("has icons in every category", () => {
    for (const category of ICON_CATEGORIES) {
      const icons = ICONS.filter((icon) => icon.category === category.id);

      expect(icons.length).toBeGreaterThan(0);
    }
  });

  it("gives every category its own id and a name", () => {
    const ids = ICON_CATEGORIES.map((category) => category.id);

    expect(new Set(ids).size).toBe(ids.length);

    for (const category of ICON_CATEGORIES) {
      expect(category.labelKey).toBeTruthy();
      expect(category.keywords.length).toBeGreaterThan(0);
    }
  });

  it("puts every icon in a category that exists", () => {
    const known = new Set(ICON_CATEGORIES.map((category) => category.id));

    for (const icon of ICONS) {
      expect(known.has(icon.category)).toBe(true);
    }
  });

  it("covers the tech and cloud provider sets the checklist asks for", () => {
    const ids = new Set(ICONS.map((icon) => icon.id));

    for (const id of [
      "javascript",
      "typescript",
      "docker",
      "kubernetes",
      "git",
      "nodejs",
      "python",
      "postgresql",
      "mongodb",
      "redis",
      "aws-s3",
      "aws-ec2",
      "aws-lambda",
      "azure-vm",
      "gcp-cloud-storage",
      "k8s-pod",
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });
});

describe("finding an icon by name", () => {
  it("finds an icon by its id", () => {
    expect(findIconByName("postgresql")?.id).toBe("postgresql");
  });

  it("finds an icon by an alias", () => {
    expect(findIconByName("postgres")?.id).toBe("postgresql");
    expect(findIconByName("k8s")?.id).toBe("kubernetes");
    expect(findIconByName("s3")?.id).toBe("aws-s3");
  });

  it("finds an icon by its display name, whatever the case", () => {
    expect(findIconByName("PostgreSQL")?.id).toBe("postgresql");
    expect(findIconByName("  DOCKER  ")?.id).toBe("docker");
  });

  it("returns null for a name it does not know", () => {
    expect(findIconByName("frobnicator")).toBeNull();
    expect(findIconByName("")).toBeNull();
    expect(findIconByName(undefined)).toBeNull();
  });

  it("finds an icon by its file id", () => {
    expect(findIconById("redis")?.id).toBe("redis");
    expect(findIconById("nope")).toBeNull();
  });
});

describe("searching the icon catalogue", () => {
  it("keeps every icon of the catalogue in the search", () => {
    const found = searchIcons("").flatMap((group) => group.icons);

    expect(found).toHaveLength(ICONS.length);
  });

  it("shows one category at a time when one is asked for", () => {
    const groups = searchIcons("", "databases");

    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe("databases");

    for (const icon of groups[0].icons) {
      expect(icon.category).toBe("databases");
    }
  });

  it("finds an icon by its name", () => {
    const found = searchIcons("postgres");

    expect(
      found.some((group) =>
        group.icons.some((icon) => icon.id === "postgresql"),
      ),
    ).toBe(true);
  });

  it("finds an icon by a word it is filed under", () => {
    const found = searchIcons("orchestration");

    expect(
      found.some((group) => group.icons.some((icon) => icon.id === "k8s-pod")),
    ).toBe(true);
  });

  it("finds an icon by its category", () => {
    const groups = searchIcons("aws");

    expect(groups.length).toBeGreaterThan(0);

    // the provider's own category is there in full
    const aws = groups.find((group) => group.category.id === "aws");

    expect(aws).toBeDefined();
    expect(aws!.icons).toHaveLength(
      ICONS.filter((icon) => icon.category === "aws").length,
    );

    // and every other group that came back has an icon that genuinely
    // answers to the word — a DynamoDB entry is filed under "aws" too
    for (const group of groups) {
      for (const icon of group.icons) {
        const words = [
          icon.id,
          icon.name.toLowerCase(),
          ...(icon.keywords ?? []),
          ...(icon.aliases ?? []),
        ];

        expect(words.some((word) => word.includes("aws"))).toBe(true);
      }
    }
  });

  it("drops the categories that have nothing to show", () => {
    expect(searchIcons("zzzzzz")).toHaveLength(0);
  });

  it("searches inside the category that was asked for", () => {
    const groups = searchIcons("pod", "kubernetes");

    expect(groups).toHaveLength(1);
    expect(groups[0].category.id).toBe("kubernetes");

    for (const icon of groups[0].icons) {
      expect(icon.category).toBe("kubernetes");
    }
  });

  it("does not leak a match from another category into a picked one", () => {
    expect(searchIcons("postgres", "aws")).toHaveLength(0);
  });
});

describe("the icons tab", () => {
  it("opens from the media panel", async () => {
    await openIconsTab();

    expect(getIconButtons().length).toBeGreaterThan(0);
  });

  it("offers a category for every kind of icon", async () => {
    await openIconsTab();

    expect(getIconCategoryButton("all")).not.toBe(null);

    for (const category of ICON_CATEGORIES) {
      expect(getIconCategoryButton(category.id)).not.toBe(null);
    }
  });

  it("shows only the icons of the category that is picked", async () => {
    await openIconsTab();

    fireEvent.click(getIconCategoryButton("databases")!);

    await waitFor(() => {
      expect(getIconButtons().length).toBeGreaterThan(0);
    });

    expect(getIconButtons().length).toBeLessThan(ICONS.length);

    for (const button of Array.from(getIconButtons())) {
      const id = button.getAttribute("data-testid")!.replace("media-icon-", "");
      const icon = ICONS.find((entry) => entry.id === id);

      expect(icon?.category).toBe("databases");
    }
  });

  it("narrows the icons down to a search", async () => {
    await openIconsTab();

    fireEvent.change(getIconSearchInput(), {
      target: { value: "postgres" },
    });

    await waitFor(() => {
      expect(getIconButtons().length).toBeGreaterThan(0);
    });

    expect(getIconButtons().length).toBeLessThan(ICONS.length);

    const ids = Array.from(getIconButtons()).map((button) =>
      button.getAttribute("data-testid"),
    );

    expect(ids).toContain("media-icon-postgresql");
  });

  it("searches inside the category that is picked", async () => {
    await openIconsTab();

    fireEvent.click(getIconCategoryButton("kubernetes")!);

    fireEvent.change(getIconSearchInput(), {
      target: { value: "pod" },
    });

    await waitFor(() => {
      expect(getIconButtons().length).toBeGreaterThan(0);
    });

    const ids = Array.from(getIconButtons()).map((button) =>
      button.getAttribute("data-testid"),
    );

    expect(ids).toEqual(["media-icon-k8s-pod"]);
  });

  it("says so when no icon matches the search", async () => {
    await openIconsTab();

    fireEvent.change(getIconSearchInput(), {
      target: { value: "nothing at all" },
    });

    await waitFor(() => {
      expect(
        document.querySelector('[data-testid="media-icons-empty"]'),
      ).not.toBe(null);
    });

    expect(getIconButtons()).toHaveLength(0);
  });

  it("goes back to every icon when the category is let go of", async () => {
    await openIconsTab();

    fireEvent.click(getIconCategoryButton("aws")!);

    await waitFor(() => {
      expect(getIconButtons().length).toBeLessThan(ICONS.length);
    });

    fireEvent.click(getIconCategoryButton("all")!);

    await waitFor(() => {
      expect(getIconButtons()).toHaveLength(ICONS.length);
    });
  });

  it("draws the icon it offers", async () => {
    await openIconsTab();

    const button = document.querySelector(
      '[data-testid="media-icon-postgresql"]',
    )!;

    expect(button.querySelector("svg")).not.toBe(null);
  });
});

describe("putting an icon on the board", () => {
  it("puts an icon on the board as an image with a file", async () => {
    await openIconsTab();

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="media-icon-docker"]',
      )!,
    );

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
    });

    const element = h.elements[0];

    expect(element.type).toBe("image");
    expect(isImageElement(element)).toBe(true);

    if (!isImageElement(element)) {
      throw new Error("the icon did not land as an image");
    }

    expect(element.fileId).toBeTruthy();

    const file = h.app.files[element.fileId!];

    expect(file).toBeDefined();
    expect(file.mimeType).toBe("image/svg+xml");
    expect(file.dataURL.startsWith("data:image/svg+xml;base64,")).toBe(true);
  });

  it("lands the icon selected, ready to be moved", async () => {
    await openIconsTab();

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="media-icon-kafka"]',
      )!,
    );

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
    });

    expect(Object.keys(h.state.selectedElementIds)).toHaveLength(1);
  });

  it("keeps the panel open so that more can be added", async () => {
    await openIconsTab();

    fireEvent.click(
      document.querySelector<HTMLButtonElement>(
        '[data-testid="media-icon-redis"]',
      )!,
    );

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
    });

    expect(document.querySelector('[data-testid="media-tab-icons"]')).not.toBe(
      null,
    );
  });

  it("inserts an icon through the same path the panel uses", async () => {
    await render(<Excalidraw />);

    const icon = findIconByName("aws-s3")!;

    act(() => {
      insertIcon(h.app as any, icon);
    });

    await waitFor(() => {
      expect(h.elements.length).toBe(1);
    });

    const element = h.elements[0] as any;

    expect(element.type).toBe("image");
    expect(h.app.files[element.fileId]).toBeDefined();
  });
});
