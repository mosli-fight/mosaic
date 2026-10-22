import clsx from "clsx";
import { lazy, Suspense, useState } from "react";

import { trackEvent } from "../../analytics";
import { useUIAppState } from "../../context/ui-appState";
import { t } from "../../i18n";

import { useApp, useExcalidrawSetAppState } from "../App";
import { Dialog } from "../Dialog";
import { TextField } from "../TextField";

import { searchEmojis } from "./emojiData";
import { GifPanel } from "./GifPanel";
import {
  insertEmoji,
  insertIcon,
  insertSticker,
  insertVideo,
} from "./insertMedia";

import "./mediaPanel.scss";

import type { VideoInsertResult } from "./insertMedia";
import type { IconAsset, IconCategoryId } from "../icons/iconDrawing";
import type { Sticker, StickerCategoryId } from "./stickerDrawing";

/**
 * The stickers tab is only fetched when it is opened: it carries the whole
 * catalogue of stickers with it, and a board that is never given a sticker
 * should not pay for one.
 */
const StickerPanel = lazy(() => import("./StickerPanel"));

/**
 * The icons tab is lazy for the same reason the stickers one is: the
 * catalogue of icons is large enough that a board which never opens it
 * should not download it.
 */
const IconPanel = lazy(() => import("../icons/IconPanel"));

/**
 * The media panel: a Miro-style shelf of things that can be put on a board.
 *
 * Three tabs hold the browsing — emoji, stickers and GIFs — and a fourth
 * mode, the video form, is where a link to a YouTube or a Vimeo video is
 * pasted in.
 *
 * The panel is a dialog because media is a one-off thing: you reach for it,
 * you take what you need, and you get back to the board. The panel stays
 * open while it is being used, so that several stickers can be added in a
 * row.
 */

type MediaTab = "emoji" | "stickers" | "icons" | "gif";
type MediaMode = MediaTab | "video";

const getVideoErrorKey = (result: VideoInsertResult) => {
  if (result.ok) {
    return null;
  }

  switch (result.reason) {
    case "empty":
      return "labels.media.video.errors.empty";
    case "invalid":
      return "labels.media.video.errors.invalid";
    case "unsupported":
    default:
      return "labels.media.video.errors.unsupported";
  }
};

const EmojiGrid = ({
  query,
  onPick,
}: {
  query: string;
  onPick: (char: string) => void;
}) => {
  const groups = searchEmojis(query);

  if (!groups.length) {
    return (
      <div className="media-panel__empty" data-testid="media-emoji-empty">
        {t("labels.media.noResults")}
      </div>
    );
  }

  return (
    <div className="media-panel__scroll">
      {groups.map((group) => (
        <div className="media-panel__group" key={group.category.id}>
          <h4 className="media-panel__group-title">
            {t(group.category.labelKey)}
          </h4>
          <div className="media-panel__emoji-grid">
            {group.entries.map((entry) => (
              <button
                type="button"
                key={`${entry.char}-${entry.name}`}
                className="media-panel__emoji"
                title={entry.name}
                aria-label={entry.name}
                data-testid={`media-emoji-${entry.name.replace(/\s+/g, "-")}`}
                onClick={() => onPick(entry.char)}
              >
                {entry.char}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export const MediaPanel = () => {
  const appState = useUIAppState();
  const setAppState = useExcalidrawSetAppState();
  const app = useApp();

  const [tab, setTab] = useState<MediaTab>("emoji");
  const [mode, setMode] = useState<MediaMode>("emoji");
  const [query, setQuery] = useState("");
  const [stickerQuery, setStickerQuery] = useState("");
  const [stickerCategory, setStickerCategory] = useState<
    StickerCategoryId | "all"
  >("all");
  const [iconQuery, setIconQuery] = useState("");
  const [iconCategory, setIconCategory] = useState<IconCategoryId | "all">(
    "all",
  );
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  if (appState.openDialog?.name !== "media") {
    return null;
  }

  const close = () => setAppState({ openDialog: null });

  const addEmoji = (char: string) => {
    trackEvent("media", "emoji", "panel");
    insertEmoji(app, char);
  };

  const addSticker = (sticker: Sticker) => {
    trackEvent("media", "sticker", sticker.id);
    insertSticker(app, sticker);
  };

  const addIcon = (icon: IconAsset) => {
    trackEvent("media", "icon", icon.id);
    insertIcon(app, icon);
  };

  const addVideo = (event: React.FormEvent) => {
    event.preventDefault();

    const result = insertVideo(app, videoUrl);
    const errorKey = getVideoErrorKey(result);

    if (errorKey) {
      setVideoError(t(errorKey));
      return;
    }

    trackEvent("media", "video", "panel");
    setVideoError(null);
    setVideoUrl("");
    close();
  };

  return (
    <Dialog
      onCloseRequest={close}
      title={t("labels.media.title")}
      size="regular"
      className="media-dialog"
    >
      <div className="media-panel">
        {mode === "video" ? (
          <div className="media-panel__video">
            <button
              type="button"
              className="media-panel__back"
              data-testid="media-video-back"
              onClick={() => {
                setMode(tab);
                setVideoError(null);
              }}
            >
              {t("labels.media.video.back")}
            </button>

            <p className="media-panel__hint">{t("labels.media.video.hint")}</p>

            <form onSubmit={addVideo}>
              <div
                className="media-panel__video-field"
                data-testid="media-video-field"
              >
                <TextField
                  value={videoUrl}
                  placeholder={t("labels.media.video.placeholder")}
                  onChange={(value) => {
                    setVideoUrl(value);
                    setVideoError(null);
                  }}
                  selectOnRender
                />
              </div>

              {videoError && (
                <div
                  className="media-panel__error"
                  data-testid="media-video-error"
                >
                  {videoError}
                </div>
              )}

              <button
                type="submit"
                className="media-panel__video-submit"
                data-testid="media-video-submit"
              >
                {t("labels.media.video.add")}
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="media-panel__toolbar">
              <div className="media-panel__tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "emoji"}
                  className={clsx("media-panel__tab", {
                    "media-panel__tab--active": tab === "emoji",
                  })}
                  data-testid="media-tab-emoji"
                  onClick={() => setTab("emoji")}
                >
                  {t("labels.media.tabs.emoji")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "stickers"}
                  className={clsx("media-panel__tab", {
                    "media-panel__tab--active": tab === "stickers",
                  })}
                  data-testid="media-tab-stickers"
                  onClick={() => setTab("stickers")}
                >
                  {t("labels.media.tabs.stickers")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "icons"}
                  className={clsx("media-panel__tab", {
                    "media-panel__tab--active": tab === "icons",
                  })}
                  data-testid="media-tab-icons"
                  onClick={() => setTab("icons")}
                >
                  {t("labels.media.tabs.icons")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === "gif"}
                  className={clsx("media-panel__tab", {
                    "media-panel__tab--active": tab === "gif",
                  })}
                  data-testid="media-tab-gif"
                  onClick={() => setTab("gif")}
                >
                  {t("labels.media.tabs.gif")}
                </button>
              </div>

              <button
                type="button"
                className="media-panel__add-video"
                data-testid="media-add-video"
                onClick={() => {
                  setMode("video");
                  setVideoError(null);
                }}
              >
                {t("labels.media.video.add")}
              </button>
            </div>

            {tab === "emoji" && (
              <div
                className="media-panel__search"
                data-testid="media-panel-search"
              >
                <TextField
                  value={query}
                  placeholder={t("labels.media.search")}
                  onChange={setQuery}
                  selectOnRender
                />
              </div>
            )}

            {tab === "emoji" ? (
              <EmojiGrid query={query} onPick={addEmoji} />
            ) : tab === "stickers" ? (
              <Suspense
                fallback={
                  <div
                    className="media-panel__empty"
                    data-testid="media-stickers-loading"
                  >
                    {t("labels.media.stickersLoading")}
                  </div>
                }
              >
                <StickerPanel
                  query={stickerQuery}
                  category={stickerCategory}
                  onQueryChange={setStickerQuery}
                  onCategoryChange={setStickerCategory}
                  onPick={addSticker}
                />
              </Suspense>
            ) : tab === "icons" ? (
              <Suspense
                fallback={
                  <div
                    className="media-panel__empty"
                    data-testid="media-icons-loading"
                  >
                    {t("labels.media.iconsLoading")}
                  </div>
                }
              >
                <IconPanel
                  query={iconQuery}
                  category={iconCategory}
                  onQueryChange={setIconQuery}
                  onCategoryChange={setIconCategory}
                  onPick={addIcon}
                />
              </Suspense>
            ) : (
              <GifPanel />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};
