/**
 * Minimal typings for jsdom.
 *
 * The package ships no types of its own and `@types/jsdom` is not a
 * dependency. Only one member is used — the `window` of a fresh document —
 * so declaring it here is smaller and more honest than adding a typings
 * package for the whole DOM surface jsdom implements.
 *
 * The declared shape is deliberately loose: `dom.ts` reads window properties
 * by name from a list, which is a lookup this typing cannot describe better
 * than `Record<string, unknown>` without inventing a second copy of the DOM.
 */
declare module "jsdom" {
  export class JSDOM {
    constructor(
      html?: string,
      options?: {
        url?: string;
        runScripts?: "dangerously" | "outside-only";
      },
    );

    readonly window: unknown;

    serialize(): string;
  }
}
