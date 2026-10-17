import { useMemo } from "react";

import { t } from "@/lib/i18n";
import { relativeTime } from "@/lib/selectors";
import { useDashboardStore } from "@/state/useDashboardStore";

/**
 * Activity timeline (STEP 5).
 *
 * Renders the raw `Activity` rows newest-first. Board names are resolved from
 * the store at render time rather than denormalised into the activity row, so a
 * rename updates every historical entry at once — an activity log that shows
 * "renamed to Old Name" after the board was renamed again is misleading.
 */
export const ActivityPage = () => {
  const activity = useDashboardStore((s) => s.activity);
  const boards = useDashboardStore((s) => s.boards);

  const rows = useMemo(
    () =>
      activity.map((entry) => ({
        entry,
        board: boards.find((b) => b.id === entry.boardId),
      })),
    [activity, boards],
  );

  return (
    <div data-testid="activity-page">
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>{t("activity.title")}</h1>

      {rows.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }} data-testid="activity-empty">
          {t("activity.empty")}
        </p>
      ) : (
        <ol
          style={{
            marginTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {rows.map(({ entry, board }) => (
            <li
              key={entry.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 13,
              }}
              data-testid="activity-row"
            >
              <span
                style={{
                  color: "var(--color-text-faint)",
                  fontVariantNumeric: "tabular-nums",
                  flex: "0 0 auto",
                }}
              >
                {relativeTime(entry.ts)}
              </span>
              <span style={{ fontWeight: 600 }}>
                {board?.name ?? "(deleted board)"}
              </span>
              <span style={{ color: "var(--color-text-muted)" }}>
                {t(`activity.type.${entry.type}`)}
              </span>
              {entry.type === "move" && entry.detail ? (
                <span style={{ color: "var(--color-text-faint)" }}>
                  →{" "}
                  {boards.find((f) => f.id === entry.detail)?.name ??
                    entry.detail ??
                    t("board.action.unfiled")}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
