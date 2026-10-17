import { useState } from "react";

import { Modal } from "@/components/common/Modal";
import { resetDatabase } from "@/lib/storage";
import { t } from "@/lib/i18n";
import { pluralize } from "@/lib/selectors";
import { useDashboardStore } from "@/state/useDashboardStore";

/**
 * Settings page (STEP 2 route `/dashboard/settings`).
 *
 * Also hosts the local-data reset. This is destructive and irreversible, so it is
 * behind a confirm dialog rather than firing on click — a mis-click here cannot
 * be undone by the trash mechanism, because it bypasses it entirely.
 */
export const SettingsPage = () => {
  const boards = useDashboardStore((s) => s.boards);
  const folders = useDashboardStore((s) => s.folders);
  const reload = useDashboardStore((s) => s.reload);
  const [confirming, setConfirming] = useState(false);

  return (
    <div data-testid="settings-page">
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>{t("settings.title")}</h1>

      <section style={{ marginTop: 24, maxWidth: 520 }}>
        <h2 style={{ fontSize: 15, margin: "0 0 6px" }}>
          {t("settings.storage")}
        </h2>
        <p
          style={{
            color: "var(--color-text-muted)",
            fontSize: 13,
            margin: "0 0 16px",
          }}
        >
          {t("settings.usage", {
            // pluralize supplies the noun and the correct "1 board" / "2 boards"
            // inflection; the template deliberately has no hard-coded plural.
            boards: pluralize(boards.length, "board"),
            folders: pluralize(folders.length, "folder"),
          })}
        </p>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          style={{
            padding: "8px 14px",
            border: "1px solid var(--color-danger)",
            borderRadius: 8,
            background: "var(--color-surface)",
            color: "var(--color-danger)",
            fontWeight: 600,
          }}
          data-testid="reset-data"
        >
          {t("settings.reset")}
        </button>
      </section>

      <Modal
        open={confirming}
        title={t("settings.reset")}
        description={t("settings.resetConfirm")}
        confirmLabel={t("common.delete")}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          void resetDatabase().then(() => reload());
          setConfirming(false);
        }}
      />
    </div>
  );
};
