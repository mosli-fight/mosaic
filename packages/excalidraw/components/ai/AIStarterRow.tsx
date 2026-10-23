/**
 * The diagram-type starters.
 *
 * A row of chips, one per kind of diagram people draw most. Clicking one
 * puts a ready-made prompt in the composer and focuses it, so the person can
 * change it before sending — nothing is sent by clicking a chip, and nothing
 * here talks to a provider. Each starter's examples are one click away too.
 *
 * The starters are plain text, so they cost nothing at runtime beyond the
 * strings: no dependency, no lazy chunk.
 */

import { useState } from "react";

import { t } from "../../i18n";

import { DIAGRAM_STARTERS } from "./starters";

import type { AIDiagramStarter } from "./starters";

/**
 * The starter row.
 *
 * @param onUse called with the prompt to put in the composer
 */
export const AIStarterRow = ({
  onUse,
}: {
  onUse: (prompt: string) => void;
}) => {
  const [openId, setOpenId] = useState<AIDiagramStarter["id"] | null>(null);

  const open = DIAGRAM_STARTERS.find((starter) => starter.id === openId);

  return (
    <div className="ai-starters" data-testid="ai-starters">
      <div className="ai-starters__row">
        {DIAGRAM_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            className="ai-starters__chip"
            data-testid={`ai-starter-${starter.id}`}
            aria-pressed={openId === starter.id}
            onClick={() => {
              onUse(starter.prompt);
              setOpenId(starter.id);
            }}
          >
            {t(starter.labelKey)}
          </button>
        ))}
      </div>

      {open && (
        <div
          className="ai-starters__examples"
          data-testid="ai-starter-examples"
        >
          <span className="ai-starters__examples-label">
            {t("labels.ai.tryExample")}
          </span>
          {open.examples.map((example) => (
            <button
              key={example}
              type="button"
              className="ai-starters__example"
              data-testid="ai-starter-example"
              onClick={() => onUse(example)}
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
