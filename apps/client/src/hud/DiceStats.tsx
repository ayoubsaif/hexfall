// "Dice" tab of the log drawer: how often each total has been rolled (specs/game-hud
// "Dice statistics").
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { DICE_TOTALS, diceCounts } from "../game/diceStats.ts";
import { useGameStore } from "../store/game.ts";

export function DiceStats() {
  const { t } = useTranslation();
  const log = useGameStore((s) => s.log);
  const { counts, total } = useMemo(() => diceCounts(log), [log]);
  const max = Math.max(0, ...Object.values(counts));

  return (
    <section aria-label={t("dialogs.feed.diceTitle")} className="flex min-h-0 flex-col gap-3 px-1">
      <p data-testid="dice-total" className="m-0 text-muted-foreground">
        {t("dialogs.feed.diceRolls", { count: total })}
      </p>
      {total === 0 ? (
        <p data-testid="dice-empty" className="m-0 text-muted-foreground">
          {t("dialogs.feed.diceEmpty")}
        </p>
      ) : (
        <ol className="m-0 flex h-48 list-none items-stretch gap-1 p-0">
          {DICE_TOTALS.map((n) => {
            const count = counts[n];
            return (
              <li
                key={n}
                data-testid="dice-bar"
                data-total={n}
                data-count={count}
                aria-label={t("dialogs.feed.diceBar", { total: n, count })}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
              >
                <span aria-hidden="true" className="text-xs tabular-nums">
                  {count}
                </span>
                <div aria-hidden="true" className="flex w-full flex-1 items-end">
                  <div
                    data-seven={n === 7 || undefined}
                    className={cn(
                      "w-full rounded-t-sm",
                      count === 0 ? "bg-ink/10" : n === 7 ? "bg-bad" : "bg-primary",
                    )}
                    style={{ height: count === 0 ? "2px" : `${(count / max) * 100}%` }}
                  />
                </div>
                <span aria-hidden="true" className="text-xs font-semibold tabular-nums">
                  {n}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
