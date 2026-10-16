import styles from "./BoardGrid.module.scss";

import { t } from "@/lib/i18n";

/**
 * Placeholder grid shown while the first read is in flight.
 *
 * ## Why this exists at all
 *
 * The board list used to render its empty state whenever `visible.length === 0`,
 * and on a cold load `boards` is `[]` before the first `reload()` resolves. So a
 * returning user with forty boards was told "No boards yet / 0 boards" for about a
 * second, then watched forty cards appear over that copy. A wrong empty state is
 * worse than no state: it says something about their data that is not true.
 *
 * ## Why shapes and not a spinner
 *
 * A spinner is honest but leaves the page blank, so the layout jumps when the data
 * lands. These tiles occupy the same boxes the real cards will, because they share
 * `BoardGrid`'s grid stylesheet — so the grid does not reflow, only fill in.
 *
 * Six is a guess at a plausible first screenful on a laptop, not a measurement.
 * Anything from one to a full row reads correctly; the point is that the page has
 * the right shape before it has the contents.
 */
export const BoardGridSkeleton = ({ count = 6 }: { count?: number }) => (
  <div className={styles.grid} aria-hidden="true" data-testid="board-skeleton">
    {Array.from({ length: count }, (_, i) => (
      <div className={styles.skeletonTile} key={i}>
        <div className={`${styles.skeletonBlock} ${styles.skeletonThumb}`} />
        <div className={styles.skeletonBody}>
          <div
            className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineTitle}`}
          />
          <div
            className={`${styles.skeletonBlock} ${styles.skeletonLine} ${styles.skeletonLineMeta}`}
          />
        </div>
      </div>
    ))}
  </div>
);

/**
 * The count shown above the grid before the first read completes.
 *
 * A dash rather than "0 boards", for the same reason the skeleton exists: zero is a
 * claim about the user's data and we do not have it yet.
 */
export const LOADING_COUNT_LABEL = "—";

/** Announced to assistive tech while the grid is a skeleton. */
export const LOADING_BOARDS_LABEL = t("board.loading");
