/**
 * The icons tab of the media panel.
 *
 * The icons are grouped into categories, and the panel switches between
 * them the way the stickers tab does. A search narrows what the categories
 * show down further — it looks inside the category that is picked, or
 * across all of them when none is.
 *
 * This lives in a module of its own because it carries the whole catalogue
 * of icons with it: the media panel only asks for it once its icons tab is
 * opened, which keeps the catalogue out of the main bundle.
 */

import clsx from "clsx";

import { t } from "../../i18n";

import { TextField } from "../TextField";

import { iconToSVG, searchIcons, ICON_CATEGORIES } from "./icons";

import type { IconAsset, IconCategoryId } from "./iconDrawing";

/**
 * The icons of one category.
 *
 * The icon is drawn by the editor itself, so the panel shows the very same
 * drawing the board will get.
 */
const IconGrid = ({
  icons,
  onPick,
}: {
  icons: readonly IconAsset[];
  onPick: (icon: IconAsset) => void;
}) => {
  return (
    <div className="media-panel__icon-grid">
      {icons.map((icon) => (
        <button
          type="button"
          key={icon.id}
          className="media-panel__icon"
          title={icon.name}
          aria-label={icon.name}
          data-testid={`media-icon-${icon.id}`}
          onClick={() => onPick(icon)}
          dangerouslySetInnerHTML={{ __html: iconToSVG(icon) }}
        />
      ))}
    </div>
  );
};

const IconPanel = ({
  query,
  category,
  onQueryChange,
  onCategoryChange,
  onPick,
}: {
  query: string;
  category: IconCategoryId | "all";
  onQueryChange: (query: string) => void;
  onCategoryChange: (category: IconCategoryId | "all") => void;
  onPick: (icon: IconAsset) => void;
}) => {
  const groups = searchIcons(query, category === "all" ? undefined : category);

  return (
    <div className="media-panel__icons">
      <div className="media-panel__search" data-testid="media-icons-search">
        <TextField
          value={query}
          placeholder={t("labels.media.iconSearch")}
          onChange={onQueryChange}
          selectOnRender
        />
      </div>

      <div
        className="media-panel__sticker-categories"
        role="tablist"
        data-testid="media-icons-categories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={category === "all"}
          className={clsx("media-panel__sticker-category", {
            "media-panel__sticker-category--active": category === "all",
          })}
          data-testid="media-icons-category-all"
          onClick={() => onCategoryChange("all")}
        >
          {t("labels.media.iconCategories.all")}
        </button>

        {ICON_CATEGORIES.map((entry) => (
          <button
            type="button"
            role="tab"
            aria-selected={category === entry.id}
            className={clsx("media-panel__sticker-category", {
              "media-panel__sticker-category--active": category === entry.id,
            })}
            key={entry.id}
            data-testid={`media-icons-category-${entry.id}`}
            onClick={() => onCategoryChange(entry.id)}
          >
            {t(entry.labelKey)}
          </button>
        ))}
      </div>

      {!groups.length ? (
        <div className="media-panel__empty" data-testid="media-icons-empty">
          {t("labels.media.iconNoResults")}
        </div>
      ) : (
        <div className="media-panel__scroll" data-testid="media-icons">
          {groups.map((group) => (
            <div className="media-panel__group" key={group.category.id}>
              {groups.length > 1 && (
                <h4 className="media-panel__group-title">
                  {t(group.category.labelKey)}
                </h4>
              )}
              <IconGrid icons={group.icons} onPick={onPick} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default IconPanel;
