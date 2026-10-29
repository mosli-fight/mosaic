/**
 * Exporting a board as an image.
 *
 * ## Reuse, not a second renderer
 *
 * `exportToSvg` is the function the app's own export dialog calls. It lives in
 * `packages/excalidraw/scene/export.ts` and knows about frames, clip paths,
 * sticky-note paper, code blocks and image files — everything the editor
 * draws. Writing a second painter here would mean the server's pictures slowly
 * stop matching the app's, which is the failure mode this package exists to
 * avoid.
 *
 * ## Why the imports are dynamic
 *
 * The editor's modules read `devicePixelRatio` and `document` *at import
 * time*. So the DOM has to exist before the import, and the import has to
 * happen inside the call rather than at the top of the file. `dom.ts` owns the
 * globals; this module only sequences them.
 *
 * ## Why PNG is refused, and what it would take
 *
 * `exportToCanvas` needs a real 2D canvas: it calls `canvas.getContext("2d")`,
 * draws with `roughjs`'s canvas renderer, and turns the result into a blob with
 * `canvas.toBlob`. jsdom has no canvas implementation, and the `canvas`
 * package (which would provide one) is a native build this server does not
 * depend on. Rather than pretend, the tool says so and points at the SVG,
 * which is resolution-independent and can be rasterised by whatever opens it.
 *
 * Fonts are not inlined either: `Fonts.generateFontFaceDeclarations` fetches
 * woff2 files over the network and subsets them with wasm, which is both slow
 * and pointless for a server that has no network contract. The SVG therefore
 * names the font families and relies on the viewer having them — the same
 * behaviour as an SVG exported with "embed fonts" turned off.
 */

import {
  DEFAULT_EXPORT_PADDING,
  SVG_DOCUMENT_PREAMBLE,
} from "@excalidraw/common";

import { getBoard, toBoardMeta } from "./db.js";
import { ensureDom } from "./dom.js";
import { readScene } from "./sceneEdit.js";
import { ToolError } from "./tools.js";

import type { OwnerIdentity, ServerOptions } from "./config.js";
import type { BoardMeta, Database } from "./db.js";
import type { ExportBoardInput } from "./schemas.js";

/** What `export_board` returns for a successful SVG export. */
export type ExportBoardResult = {
  board: BoardMeta;
  format: "svg";
  /** The SVG document, ready to be written to a `.svg` file. */
  content: string;
  /** Size of `content` in UTF-8 bytes. */
  bytes: number;
  /** The document's viewBox, so a caller can size the page it goes on. */
  width: number;
  height: number;
  message: string;
};

/**
 * The app's own default background.
 *
 * A board that has never been themed has no `viewBackgroundColor` stored, and
 * an export with no background would come out transparent — which looks broken
 * when pasted onto a dark page. The editor's default is white.
 */
const DEFAULT_VIEW_BACKGROUND = "#ffffff";

/** Reads the `viewBox` of an exported document as a width and height. */
const sizeOf = (viewBox: string | null): { width: number; height: number } => {
  const parts = (viewBox ?? "").trim().split(/\s+/).map(Number);

  if (parts.length !== 4 || !parts.every(Number.isFinite)) {
    return { width: 0, height: 0 };
  }

  return { width: parts[2], height: parts[3] };
};

/**
 * Exports a board as SVG.
 *
 * The board is read under the caller's owner scope, so a board that is not
 * theirs is reported as missing — the same answer `get_board` gives, for the
 * same reason: a different one would confirm the id exists.
 */
export const runExportBoard = async (
  db: Database,
  owner: OwnerIdentity,
  options: ServerOptions,
  input: ExportBoardInput,
): Promise<ExportBoardResult> => {
  if (input.format === "png") {
    throw new ToolError(
      "PNG export is not available from this server. Rasterising a board " +
        "needs a canvas implementation, which a stdio process does not have — " +
        "the export pipeline would need a headless browser. Nothing was " +
        'exported. Ask for format "svg" instead: it is the same picture, ' +
        "resolution-independent, and any image tool can convert it to PNG.",
    );
  }

  const row = await getBoard(db, owner, input.boardId);

  if (!row) {
    throw new ToolError(
      `No board with id ${input.boardId} is visible to this server. It may ` +
        "not exist, or it may belong to another owner.",
    );
  }

  const sceneBytes = row.scene ? Buffer.byteLength(row.scene, "utf8") : 0;

  if (sceneBytes > options.maxSceneBytes) {
    throw new ToolError(
      `Board ${input.boardId}'s scene is ${sceneBytes} bytes, above the ` +
        `${options.maxSceneBytes}-byte limit this server will parse ` +
        "(MOSAIC_MCP_MAX_SCENE_BYTES). Nothing was exported. Raise that limit " +
        "if the board is legitimately this large.",
    );
  }

  const scene = readScene(row.scene);
  const storedAppState =
    typeof scene.document.appState === "object" &&
    scene.document.appState !== null
      ? (scene.document.appState as Record<string, unknown>)
      : {};
  const storedFiles =
    typeof scene.document.files === "object" && scene.document.files !== null
      ? (scene.document.files as Record<string, unknown>)
      : {};

  const viewBackgroundColor =
    typeof storedAppState.viewBackgroundColor === "string" &&
    storedAppState.viewBackgroundColor
      ? storedAppState.viewBackgroundColor
      : DEFAULT_VIEW_BACKGROUND;

  // The DOM must exist before the editor modules are imported: `appState.ts`
  // reads `devicePixelRatio` while its module body runs.
  ensureDom();

  const [
    { exportToSvg },
    { restoreAppState, restoreElements },
    { getNonDeletedElements },
  ] = await Promise.all([
    import("@excalidraw/excalidraw/scene/export"),
    import("@excalidraw/excalidraw/data/restore"),
    import("@excalidraw/element"),
  ]);

  let svg: SVGSVGElement;

  try {
    // The same restore the app performs before an export: invisible elements
    // are dropped, legacy fields are migrated, and bindings are repaired. It
    // is what makes a stored scene and a live one export identically.
    const elements = getNonDeletedElements(
      restoreElements(scene.elements, null, { deleteInvisibleElements: true }),
    );
    const appState = restoreAppState(
      {
        ...storedAppState,
        exportBackground: input.background !== false,
        exportPadding: input.padding ?? DEFAULT_EXPORT_PADDING,
        viewBackgroundColor,
        exportScale: 1,
        exportWithDarkMode: false,
        exportEmbedScene: false,
      } as Parameters<typeof restoreAppState>[0],
      null,
    );

    svg = await exportToSvg(
      elements,
      {
        ...appState,
        exportBackground: input.background !== false,
        exportPadding: input.padding ?? DEFAULT_EXPORT_PADDING,
        viewBackgroundColor,
        exportScale: 1,
      },
      storedFiles as Parameters<typeof exportToSvg>[2],
      {
        // Fonts are not fetched: see the module comment.
        skipInliningFonts: true,
      },
    );
  } catch (error) {
    // The renderer can fail on content this server did not create — a corrupt
    // image file, an embeddable it cannot resolve. The message is the useful
    // part; the stack goes to stderr via `guard`.
    throw new ToolError(
      `Board ${row.id} could not be rendered to SVG: ${
        error instanceof Error ? error.message : String(error)
      }. Nothing was exported.`,
    );
  }

  const content = `${SVG_DOCUMENT_PREAMBLE}${svg.outerHTML}`;
  const bytes = Buffer.byteLength(content, "utf8");

  if (bytes > options.maxExportBytes) {
    throw new ToolError(
      `The SVG for board ${row.id} would be ${bytes} bytes, above the ` +
        `${options.maxExportBytes}-byte export cap (MOSAIC_MCP_MAX_EXPORT_BYTES). ` +
        "Nothing was exported. Raise that limit, or export a board with less " +
        "content on it.",
    );
  }

  const { width, height } = sizeOf(svg.getAttribute("viewBox"));
  const elementCount = scene.elements.filter(
    (element) => !element.isDeleted,
  ).length;

  return {
    board: toBoardMeta(row),
    format: "svg",
    content,
    bytes,
    width,
    height,
    message:
      `Exported board "${row.name}" as SVG: ${elementCount} element` +
      `${elementCount === 1 ? "" : "s"}, ${width}×${height} units, ` +
      `${bytes} bytes.`,
  };
};
