import clsx from "clsx";

import { t } from "../../i18n";

import { TextField } from "../TextField";

import { searchStickers, STICKER_CATEGORIES, stickerToSVG } from "./stickers";

import type { Sticker, StickerCategoryId } from "./stickerDrawing";

/**
 * The stickers tab of the media panel.
 *
 * The stickers are grouped into categories, and the panel switches between
 * them the way a shelf of stickers is walked through. A search narrows
 * what the categories show down further — it looks inside the category
 * that is picked, or across all of them when none is.
 *
 * This lives in a module of its own because it carries the whole catalogue
 * of stickers with it: the media panel only asks for it once its stickers
 * tab is opened, which keeps the catalogue out of the main bundle.
 */

/**
 * The stickers of one category.
 *
 * The sticker is drawn by the editor itself, so the panel shows the very
 * same drawing the board will get.
 */
const StickerGrid = ({
  stickers,
  onPick,
}: {
  stickers: readonly Sticker[];
  onPick: (sticker: Sticker) => void;
}) => {
  return (
    <div className="media-panel__sticker-grid">
      {stickers.map((sticker) => (
        <button
          type="button"
          key={sticker.id}
          className="media-panel__sticker"
          title={sticker.name}
          aria-label={sticker.name}
          data-testid={`media-sticker-${sticker.id}`}
          onClick={() => onPick(sticker)}
          dangerouslySetInnerHTML={{ __html: stickerToSVG(sticker) }}
        />
      ))}
    </div>
  );
};

const StickerPanel = ({
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onPick,
}: {
  query: string;
  category: StickerCategoryId | "all";
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: StickerCategoryId | "all") => void;
  onPick: (sticker: Sticker) => void;
}) => {
  const groups = searchStickers(
    query,
    category === "all" ? undefined : category,
  );

  return (
    <div className="media-panel__stickers">
      <div className="media-panel__search" data-testid="media-stickers-search">
        <TextField
          value={query}
          placeholder={t("labels.media.stickerSearch")}
          onChange={onQueryChange}
          selectOnRender
        />
      </div>

      <div
        className="media-panel__sticker-categories"
        role="tablist"
        data-testid="media-stickers-categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          className={clsx("media-panel__sticker-category", {
            "media-panel__sticker-category--active": category === "all",
          })}
          data-testid="media-stickers-category-all"
          onClick={() => onCategoryChange("all")}
        >
          {t("labels.media.stickerCategories.all")}
        </button>

        {STICKER_CATEGORIES.map((entry) => (
          <button
            type="button"
            role="tab"
            aria-selected={category === entry.id}
            className={clsx("media-panel__sticker-category", {
              "media-panel__sticker-category--active": category === entry.id,
            })}
            key={entry.id}
            data-testid={`media-stickers-category-${entry.id}`}
            onClick={() => onCategoryChange(entry.id)}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </div>

      {!groups.length ? (
        <div className="media-panel__empty" data-testid="media-stickers-empty">
          {t("labels.media.stickerNoResults")}
        </div>
      ) : (
        <div className="media-panel__scroll" data-testid="media-stickers">
          {groups.map((group) => (
            <div className="media-panel__group" key={group.category.id}>
              {groups.length > 1 && (
                <h4 className="media-panel__group-title">
                  {t(group.category.labelKey)}
                </h4>
              )}
              <StickerGrid stickers={group.stickers} onPick={onPick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StickerPanel;
