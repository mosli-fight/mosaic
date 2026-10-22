/**
 * The templates module: the vocabulary of a template, the builder that turns
 * a template into elements, and the way the gallery finds templates.
 *
 * The catalogue itself — the templates as data — lives in `./catalogue` and
 * is loaded only when the gallery is opened, so that a board which never
 * looks at the gallery does not carry the catalogue with it.
 */

export * from "./types";
export * from "./builder";
export * from "./search";
