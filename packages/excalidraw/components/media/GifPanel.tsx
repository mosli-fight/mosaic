/**
 * The GIFs tab of the media panel.
 *
 * Searching for a GIF needs a provider, and Mosaic ships none: the user
 * brings their own key, which is kept in this browser and nowhere else.
 * Until there is a key there is nothing to search with, so the tab says so
 * and asks for one rather than showing a wall of errors.
 *
 * What is put on the board is the animated file itself — the bytes are
 * fetched whole and stored whole, so that the GIF keeps moving.
 */

import { useEffect, useState } from "react";

import { trackEvent } from "../../analytics";
import { t } from "../../i18n";

import { useApp } from "../App";
import { TextField } from "../TextField";

import { GifApiError, fetchGifDataURL, searchGifs } from "./gifApi";
import {
  clearGifSettings,
  loadGifSettings,
  saveGifSettings,
} from "./gifSettings";
import { insertGif } from "./insertMedia";

import type { GifSearchResult } from "./gifApi";

/** how long the panel waits for the user to stop typing */
const GIF_SEARCH_DEBOUNCE = 300;

/** where a free provider key comes from */
const GIF_PROVIDER_SIGNUP_URL = "https://giphy.com/developers";

/**
 * The i18n key that goes with a failure.
 */
type GifErrorKey =
  | "labels.media.gif.errors.unauthorized"
  | "labels.media.gif.errors.network"
  | "labels.media.gif.errors.notFound"
  | "labels.media.gif.errors.tooLarge"
  | "labels.media.gif.errors.unknown";

const getGifErrorKey = (error: unknown): GifErrorKey => {
  if (error instanceof GifApiError) {
    switch (error.reason) {
      case "unauthorized":
        return "labels.media.gif.errors.unauthorized";
      case "network":
        return "labels.media.gif.errors.network";
      case "notFound":
        return "labels.media.gif.errors.notFound";
      case "tooLarge":
        return "labels.media.gif.errors.tooLarge";
      case "unknown":
      default:
        return "labels.media.gif.errors.unknown";
    }
  }

  return "labels.media.gif.errors.unknown";
};

export const GifPanel = () => {
  const app = useApp();

  const [apiKey, setApiKey] = useState<string | null>(
    () => loadGifSettings()?.apiKey ?? null,
  );
  const [isSetupOpen, setIsSetupOpen] = useState(() => !loadGifSettings());
  const [keyDraft, setKeyDraft] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GifSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [errorKey, setErrorKey] = useState<GifErrorKey | null>(null);
  const [insertingId, setInsertingId] = useState<string | null>(null);

  /**
   * Searches for what the user is typing — once they have stopped typing.
   */
  useEffect(() => {
    const trimmed = query.trim();

    if (!apiKey || !trimmed) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setIsSearching(true);
      setErrorKey(null);

      try {
        const found = await searchGifs({
          apiKey,
          query: trimmed,
          signal: controller.signal,
        });

        setResults(found);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setResults([]);
        setErrorKey(getGifErrorKey(error));
      } finally {
        setIsSearching(false);
      }
    }, GIF_SEARCH_DEBOUNCE);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [apiKey, query]);

  const saveKey = () => {
    const saved = saveGifSettings({ apiKey: keyDraft });

    if (!saved) {
      setStatus(t("labels.media.gif.setup.savingFailed"));
      return;
    }

    setApiKey(saved.apiKey);
    setKeyDraft("");
    setShowKey(false);
    setIsSetupOpen(false);
    setStatus(t("labels.media.gif.setup.saved"));
  };

  const removeKey = () => {
    clearGifSettings();
    setApiKey(null);
    setKeyDraft("");
    setResults([]);
    setIsSetupOpen(true);
    setStatus(t("labels.media.gif.setup.removed"));
  };

  /**
   * Puts a GIF on the board.
   *
   * The bytes are fetched first and inserted after: the board is given the
   * animated file, not a link to it and not a still of it.
   */
  const addGif = async (gif: GifSearchResult) => {
    setInsertingId(gif.id);
    setErrorKey(null);

    try {
      const dataURL = await fetchGifDataURL({ url: gif.url });

      insertGif(app, { dataURL, width: gif.width, height: gif.height });
      trackEvent("media", "gif", gif.id);
    } catch (error) {
      setErrorKey(getGifErrorKey(error));
    } finally {
      setInsertingId(null);
    }
  };

  if (!apiKey || isSetupOpen) {
    return (
      <div className="media-panel__gif-setup" data-testid="media-gif-setup">
        <h4 className="media-panel__group-title">
          {t("labels.media.gif.setup.title")}
        </h4>

        <p className="media-panel__hint">
          {t("labels.media.gif.setup.description")}
        </p>

        <p className="media-panel__hint">
          <a
            className="media-panel__link"
            href={GIF_PROVIDER_SIGNUP_URL}
            target="_blank"
            rel="noreferrer"
            data-testid="media-gif-get-key"
          >
            {t("labels.media.gif.setup.getKey")}
          </a>
        </p>

        <label className="media-panel__gif-field">
          <span className="media-panel__gif-label">
            {t("labels.media.gif.setup.apiKey")}
          </span>
          <div className="media-panel__gif-input-row">
            <input
              className="media-panel__gif-input"
              type={showKey ? "text" : "password"}
              value={keyDraft}
              placeholder={t("labels.media.gif.setup.apiKeyPlaceholder")}
              data-testid="media-gif-api-key"
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => {
                setKeyDraft(event.target.value);
                setStatus(null);
              }}
            />
            <button
              type="button"
              className="media-panel__back"
              data-testid="media-gif-toggle-key"
              onClick={() => setShowKey((shown) => !shown)}
            >
              {showKey
                ? t("labels.media.gif.setup.hideKey")
                : t("labels.media.gif.setup.showKey")}
            </button>
          </div>
        </label>

        <p className="media-panel__hint">
          {t("labels.media.gif.setup.privacyNote")}
        </p>

        <div className="media-panel__gif-actions">
          <button
            type="button"
            className="media-panel__video-submit"
            data-testid="media-gif-save"
            onClick={saveKey}
          >
            {t("labels.media.gif.setup.save")}
          </button>

          {apiKey && (
            <button
              type="button"
              className="media-panel__back"
              data-testid="media-gif-remove"
              onClick={removeKey}
            >
              {t("labels.media.gif.setup.remove")}
            </button>
          )}

          {apiKey && (
            <button
              type="button"
              className="media-panel__back"
              data-testid="media-gif-cancel"
              onClick={() => setIsSetupOpen(false)}
            >
              {t("labels.media.gif.setup.cancel")}
            </button>
          )}
        </div>

        {status && (
          <p className="media-panel__gif-status" data-testid="media-gif-status">
            {status}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="media-panel__gifs">
      <div className="media-panel__search" data-testid="media-gif-search">
        <TextField
          value={query}
          placeholder={t("labels.media.gif.searchPlaceholder")}
          onChange={setQuery}
          selectOnRender
        />
      </div>

      <div className="media-panel__gif-toolbar">
        <button
          type="button"
          className="media-panel__back"
          data-testid="media-gif-settings"
          onClick={() => {
            setKeyDraft(apiKey ?? "");
            setIsSetupOpen(true);
            setStatus(null);
          }}
        >
          {t("labels.media.gif.setup.change")}
        </button>
      </div>

      {status && (
        <p className="media-panel__gif-status" data-testid="media-gif-status">
          {status}
        </p>
      )}

      {isSearching && (
        <div className="media-panel__empty" data-testid="media-gif-loading">
          {t("labels.media.gif.loading")}
        </div>
      )}

      {errorKey && (
        <div className="media-panel__error" data-testid="media-gif-error">
          {t(errorKey)}
        </div>
      )}

      {!isSearching && !errorKey && results.length === 0 && (
        <div className="media-panel__empty" data-testid="media-gif-empty">
          {query.trim()
            ? t("labels.media.gif.noResults")
            : t("labels.media.gif.hint")}
        </div>
      )}

      {results.length > 0 && (
        <div className="media-panel__scroll">
          <div className="media-panel__gif-grid" data-testid="media-gifs">
            {results.map((gif) => (
              <button
                type="button"
                key={gif.id}
                className="media-panel__gif"
                data-testid={`media-gif-${gif.id}`}
                aria-label={gif.title || t("labels.media.gif.insert")}
                disabled={insertingId === gif.id}
                onClick={() => addGif(gif)}
              >
                <img
                  src={gif.previewUrl}
                  alt=""
                  loading="lazy"
                  data-testid={`media-gif-preview-${gif.id}`}
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
