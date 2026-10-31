/**
 * A DOM for the one thing in this server that needs one: SVG export.
 *
 * Everything else the server does — reading scenes, building elements, laying
 * out diagrams — is plain data. The export pipeline is not: `exportToSvg` is
 * the same function the app's export dialog calls, and it builds a real
 * `SVGSVGElement` with `document.createElementNS`. There is no headless
 * browser here and no native canvas, so the smallest honest way to reuse that
 * pipeline is to give it a DOM that can hold elements and serialise them.
 *
 * ## Why jsdom rather than a re-implementation
 *
 * The alternative was to write a second SVG renderer against the element
 * model. That is exactly the drift the rest of this package avoids: the app
 * would gain a rendering change and the server's pictures would quietly stop
 * matching. jsdom implements the parts the pipeline touches (element
 * creation, attributes, `outerHTML`) and nothing else.
 *
 * ## Why the globals are installed before the import
 *
 * The editor's modules read `devicePixelRatio` and `document` *at import
 * time* — `appState.ts` computes its default export scale from
 * `devicePixelRatio` in a module-level constant. So the caller must run
 * {@link ensureDom} and only then `await import(...)` the export modules.
 * That is why `exportBoard.ts` imports them dynamically rather than at the top
 * of the file, and why this module is the only place that knows about jsdom.
 *
 * ## The canvas shim, and what it costs
 *
 * jsdom has no 2D canvas context. The export path uses one in exactly one
 * place: `truncateText`, which shortens a frame's title so it fits the frame.
 * Without a context that call throws. Rather than pull in a native canvas
 * (a build-tool dependency, for one measurement) the shim below answers
 * `measureText` with the same estimator `textMetrics.ts` already installs for
 * the element constructors. The consequence is stated plainly: a frame title
 * that is *just* too wide may be cut at a slightly different character than
 * the browser would cut it. The alternative — no frame titles at all — is
 * worse.
 */

import { getFontSizeFromFontString } from "@excalidraw/common";
import { JSDOM } from "jsdom";

import type { FontString } from "@excalidraw/element/types";

import { estimateLineWidth } from "./textMetrics.js";

/** The fallback size when a font shorthand cannot be read. */
const FALLBACK_FONT_SIZE = 16;

let installed = false;

/**
 * The window properties the export path reads.
 *
 * A list rather than "copy every property of the window": copying everything
 * would overwrite Node's own `fetch`, `performance`, `crypto` and timers with
 * jsdom's, which is a much larger change to the process than an exporter
 * needs. `location` and `history` are left out for the same reason.
 */
const GLOBALS = [
  "window",
  "document",
  "navigator",
  "HTMLElement",
  "HTMLCanvasElement",
  "HTMLImageElement",
  "HTMLDivElement",
  "SVGElement",
  "SVGSVGElement",
  "Element",
  "Node",
  "Text",
  "DocumentFragment",
  "XMLSerializer",
  "DOMParser",
  "Image",
  "Event",
  "CustomEvent",
  "MouseEvent",
  "KeyboardEvent",
  "PointerEvent",
  "MutationObserver",
  "getComputedStyle",
  "requestAnimationFrame",
  "cancelAnimationFrame",
] as const;

/**
 * Defines a global, replacing one that already exists.
 *
 * Assignment is not enough: Node 24 exposes `navigator` as a getter with no
 * setter, so `globalThis.navigator = ...` throws. `defineProperty` with
 * `configurable: true` replaces it and leaves the process able to do so again
 * if a test wants a fresh window.
 *
 * A property that cannot be redefined is left alone rather than aborting the
 * install: a host that has already supplied a DOM (a test runner in jsdom
 * mode, say) has supplied the very thing this module would have made.
 */
const define = (name: string, value: unknown): void => {
  try {
    Object.defineProperty(globalThis, name, {
      value,
      configurable: true,
      writable: true,
    });
  } catch {
    // Non-configurable in this host. Nothing to do: the existing value is a
    // DOM global already, which is what the caller needs.
  }
};

/** A 2D context that can measure text, and nothing else. */
const measuringContext = () => {
  // `CanvasRenderingContext2D.font` is a plain `string` in the DOM lib, but the
  // editor's measurement helpers take the branded `FontString` they produce
  // from `getFontString`. The value a caller assigns here *is* a CSS font
  // shorthand, so the cast is at the one boundary where an untyped string
  // enters — the same place the editor itself brands the string it builds.
  let font = `${FALLBACK_FONT_SIZE}px sans-serif` as FontString;

  return {
    get font() {
      return font;
    },
    set font(value: string) {
      font = value as FontString;
    },
    measureText: (text: string) => {
      const size = getFontSizeFromFontString(font);
      return {
        width: estimateLineWidth(
          text,
          Number.isFinite(size) ? size : FALLBACK_FONT_SIZE,
        ),
      };
    },
  };
};

/**
 * Gives the window a 2D context that can measure text, if it has none.
 *
 * Only `font` and `measureText` are implemented, because those are the only
 * members `truncateText` touches. A host whose canvas already works — the
 * editor's own test setup mocks one — is left untouched: replacing a real
 * implementation with this approximation would be a downgrade.
 */
const installCanvasMeasure = (window: Record<string, unknown>): void => {
  const prototype = (
    window.HTMLCanvasElement as { prototype?: object } | undefined
  )?.prototype as Record<string, unknown> | undefined;

  if (!prototype || typeof prototype.getContext !== "function") {
    return;
  }

  const original = prototype.getContext as (
    this: unknown,
    ...args: unknown[]
  ) => unknown;

  prototype.getContext = function (this: unknown, ...args: unknown[]) {
    const context = original.apply(this, args);

    if (context) {
      return context;
    }

    return args[0] === "2d" ? measuringContext() : context;
  };
};

/**
 * Installs the DOM globals, once.
 *
 * Idempotent: a second call is a no-op, so a caller does not have to know
 * whether some earlier tool call already exported a board. The DOM is never
 * torn down — the process serves one client for its lifetime, and a window
 * that outlives the call that made it costs a few hundred kilobytes.
 */
export const ensureDom = (): void => {
  if (installed) {
    return;
  }

  installed = true;

  // A host that already has a document (a test runner in jsdom mode) keeps
  // it. Only the canvas gap is closed, and only if it is a gap.
  const existing = (globalThis as Record<string, unknown>).document as
    | { createElementNS?: unknown; defaultView?: unknown }
    | undefined;

  if (existing && typeof existing.createElementNS === "function") {
    installCanvasMeasure(
      (existing.defaultView ?? globalThis) as Record<string, unknown>,
    );
    return;
  }

  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  const window = dom.window as unknown as Record<string, unknown>;

  for (const name of GLOBALS) {
    const value = window[name];

    if (value !== undefined) {
      define(name, value);
    }
  }

  // jsdom reports 1, which is the right scale for an export that is meant to
  // be resolution-independent.
  define("devicePixelRatio", window.devicePixelRatio ?? 1);

  installCanvasMeasure(window);
};
