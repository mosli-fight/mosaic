/**
 * Talking to a GIF provider.
 *
 * The provider is Giphy, and the key is the user's own: it is read from
 * this browser (see `gifSettings`) and sent with the search, never kept
 * anywhere else and never bundled with the editor.
 *
 * What comes back is only ever a url. The bytes are fetched separately, so
 * that the animated file — not a still of it — is what lands on the board.
 */

import { MIME_TYPES } from "@excalidraw/common";

import type { DataURL } from "../../types";

/** where the provider lives */
const GIPHY_API_URL = "https://api.giphy.com/v1/gifs/search";

/** how many GIFs a search asks for */
export const GIF_SEARCH_LIMIT = 24;

/**
 * The biggest GIF that is put on a board.
 *
 * The bytes travel with the scene, so there is a limit to how much of them
 * a board should carry around.
 */
export const GIF_MAX_BYTES = 3 * 1024 * 1024;

/** why a search or a download did not work out */
export type GifErrorReason =
  | "unauthorized"
  | "network"
  | "notFound"
  | "tooLarge"
  | "unknown";

/**
 * A failure the panel can say something useful about.
 */
export class GifApiError extends Error {
  public reason: GifErrorReason;
  public status?: number;

  constructor(reason: GifErrorReason, message: string, status?: number) {
    super(message);
    this.name = "GifApiError";
    this.reason = reason;
    this.status = status;
  }
}

/** a GIF the user can put on the board */
export type GifSearchResult = {
  id: string;
  title: string;
  /** the small animated preview shown in the grid */
  previewUrl: string;
  /** the animated GIF itself */
  url: string;
  /** the size of the GIF, in pixels */
  width: number;
  height: number;
};

/** the shape of the part of the provider's answer we care about */
type RawGif = {
  id?: string;
  title?: string;
  images?: Record<
    string,
    { url?: string; width?: number; height?: number } | undefined
  >;
};

/**
 * The failure a status code stands for.
 */
const reasonForStatus = (status: number): GifErrorReason => {
  if (status === 401 || status === 403) {
    return "unauthorized";
  }

  if (status === 404) {
    return "notFound";
  }

  return "unknown";
};

/**
 * The url of a search.
 *
 * The key goes in the query string, because that is how the provider wants
 * it — the request itself carries nothing the user would mind seeing.
 */
export const buildSearchUrl = ({
  apiKey,
  query,
  limit = GIF_SEARCH_LIMIT,
}: {
  apiKey: string;
  query: string;
  limit?: number;
}) => {
  const params = new URLSearchParams({
    api_key: apiKey,
    q: query,
    limit: String(limit),
    rating: "g",
  });

  return `${GIPHY_API_URL}?${params.toString()}`;
};

/**
 * The GIFs a search found.
 *
 * The provider's answer is read defensively: an entry without a GIF in it
 * is dropped rather than shown as a broken tile.
 */
const parseResults = (payload: unknown): GifSearchResult[] => {
  const data = (payload as { data?: RawGif[] })?.data;

  if (!Array.isArray(data)) {
    return [];
  }

  return data.reduce<GifSearchResult[]>((results, entry) => {
    const images = entry?.images ?? {};

    const full =
      images.fixed_width ?? images.downsized ?? images.original ?? undefined;

    const preview =
      images.preview_gif ?? images.fixed_width_small ?? full ?? undefined;

    if (!entry?.id || !full?.url || !preview?.url) {
      return results;
    }

    results.push({
      id: entry.id,
      title: entry.title?.trim() || "",
      previewUrl: preview.url,
      url: full.url,
      width: full.width ?? preview.width ?? 0,
      height: full.height ?? preview.height ?? 0,
    });

    return results;
  }, []);
};

/**
 * Searches the provider for GIFs.
 *
 * @param apiKey the user's own key for the provider
 * @param query what the user is looking for
 * @param signal lets the caller walk away from a search it does not want
 */
export const searchGifs = async ({
  apiKey,
  query,
  signal,
  limit = GIF_SEARCH_LIMIT,
}: {
  apiKey: string;
  query: string;
  signal?: AbortSignal;
  limit?: number;
}): Promise<GifSearchResult[]> => {
  let response: Response;

  try {
    response = await fetch(buildSearchUrl({ apiKey, query, limit }), {
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new GifApiError("network", "The GIF provider could not be reached");
  }

  if (!response.ok) {
    throw new GifApiError(
      reasonForStatus(response.status),
      "The GIF provider refused the search",
      response.status,
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new GifApiError(
      "unknown",
      "The GIF provider sent an unreadable answer",
    );
  }

  return parseResults(payload);
};

/**
 * The bytes of a GIF, as a data url.
 *
 * The file is fetched whole and kept whole: a GIF that has been through an
 * image resizer is a GIF that has stopped moving, and a still of a moving
 * picture is not what the user asked for.
 */
export const fetchGifDataURL = async ({
  url,
  signal,
  maxBytes = GIF_MAX_BYTES,
}: {
  url: string;
  signal?: AbortSignal;
  maxBytes?: number;
}): Promise<DataURL> => {
  let response: Response;

  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }

    throw new GifApiError("network", "The GIF could not be downloaded");
  }

  if (!response.ok) {
    throw new GifApiError(
      reasonForStatus(response.status),
      "The GIF could not be downloaded",
      response.status,
    );
  }

  const contentType = response.headers?.get?.("content-type") ?? "";

  if (contentType && !contentType.includes("gif")) {
    throw new GifApiError("unknown", "The download was not a GIF");
  }

  let bytes: ArrayBuffer;
  try {
    bytes = await response.arrayBuffer();
  } catch {
    throw new GifApiError("unknown", "The GIF could not be read");
  }

  if (bytes.byteLength > maxBytes) {
    throw new GifApiError("tooLarge", "The GIF is too large to put on a board");
  }

  return `data:${MIME_TYPES.gif};base64,${toBase64(
    new Uint8Array(bytes),
  )}` as DataURL;
};

/**
 * The bytes as base64.
 *
 * Done by hand rather than through a `FileReader`, because the answer is
 * wanted as a string the editor can store, and because a big GIF would
 * otherwise be turned into a very long string of one-character calls.
 */
const toBase64 = (bytes: Uint8Array) => {
  const chunkSize = 0x8000;
  let binary = "";

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }

  return btoa(binary);
};
