// Player-to-player offer composer (specs/player-trade "Offer composer"). Opens from the Trade
// with players button, a Counter in the offers tray, or Make an offer; the prefill comes from
// the ui store's `tradeDraft`. The server stays the judge: this only gates Send offer.
import type { ResourceBundle, ResourceCounts, Seat } from "@hexfall/engine";
import { RESOURCES } from "@hexfall/engine/geometry";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { MAX_ASK, compact, formatBundle, isValidOffer, total } from "../game/cards.ts";
import { seatColor } from "../game/colors.ts";
import { resourceLabel } from "../i18n/labels.ts";
import { act } from "../net/actions.ts";
import { type TradeDraft, openDialog, useUiStore } from "../store/ui.ts";
import { GameCard } from "./cards/GameCard.tsx";
import { Counter } from "./cards/Stepper.tsx";
import { useNames } from "./names.ts";
import { useInFlight, useLegal, useOwn, useView } from "./state.ts";

/** Sets one side of a resource; any count on the other side of that resource goes to zero. */
function setSide(
  sides: { give: ResourceBundle; get: ResourceBundle },
  side: "give" | "get",
  r: (typeof RESOURCES)[number],
  n: number,
): { give: ResourceBundle; get: ResourceBundle } {
  const other = side === "give" ? "get" : "give";
  const next = { give: { ...sides.give }, get: { ...sides.get } };
  next[side][r] = n;
  if (n > 0) next[other][r] = 0;
  return next;
}

function Composer({
  draft,
  hand,
  viewer,
  active,
  opponents,
}: {
  draft: TradeDraft;
  hand: ResourceCounts;
  viewer: Seat;
  active: Seat;
  opponents: Seat[];
}) {
  const { t } = useTranslation();
  const names = useNames();
  const legal = useLegal();
  const inFlight = useInFlight();
  const [sides, setSides] = useState(() => ({ give: { ...draft.give }, get: { ...draft.get } }));
  const isActive = viewer === active;
  const [to, setTo] = useState<Seat[]>(() =>
    isActive ? draft.to.filter((s) => opponents.includes(s)) : [active],
  );
  const give = compact(sides.give);
  const get = compact(sides.get);
  const ok = isValidOffer(hand, give, get) && to.length > 0 && !!legal?.proposeTrade && !inFlight;
  const complete = total(give) > 0 && total(get) > 0;

  return (
    <DialogContent
      title={t("dialogs.trade.title")}
      description={t("dialogs.trade.description")}
      className="w-[min(480px,calc(100%-32px))]"
    >
      <div
        role="group"
        aria-label={t("dialogs.trade.title")}
        className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1"
      >
        <span />
        <span />
        <span className="text-center text-xs font-semibold">{t("dialogs.trade.give")}</span>
        <span className="text-center text-xs font-semibold">{t("dialogs.trade.ask")}</span>
        {RESOURCES.map((r) => {
          const label = resourceLabel(t, r);
          const g = sides.give[r] ?? 0;
          const a = sides.get[r] ?? 0;
          return (
            <div key={r} className="contents" data-resource={r} data-trade-row>
              <GameCard resource={r} size="md" />
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{label}</span>
                <span className="text-xs text-muted-foreground">
                  {t("dialogs.trade.have", { count: hand[r] })}
                </span>
              </span>
              <span data-side="give">
                <Counter
                  value={g}
                  canAdd={g < hand[r]}
                  lessLabel={t("dialogs.trade.giveLess", { resource: label })}
                  moreLabel={t("dialogs.trade.giveMore", { resource: label })}
                  onChange={(n) => setSides(setSide(sides, "give", r, n))}
                />
              </span>
              <span data-side="get">
                <Counter
                  value={a}
                  canAdd={a < MAX_ASK}
                  lessLabel={t("dialogs.trade.askLess", { resource: label })}
                  moreLabel={t("dialogs.trade.askMore", { resource: label })}
                  onChange={(n) => setSides(setSide(sides, "get", r, n))}
                />
              </span>
            </div>
          );
        })}
      </div>

      <fieldset className="mt-3">
        <legend className="mb-1 text-sm font-semibold">{t("dialogs.trade.recipients")}</legend>
        {isActive ? (
          <div className="flex flex-wrap gap-1.5" data-testid="trade-recipients">
            {opponents.map((seat) => {
              const on = to.includes(seat);
              return (
                <button
                  key={seat}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  data-seat={seat}
                  onClick={() =>
                    setTo(on ? to.filter((s) => s !== seat) : [...to, seat].sort((x, y) => x - y))
                  }
                  className={cn(
                    "pointer-events-auto flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    on ? "bg-ink/15" : "opacity-60",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="size-2.5 rounded-sm"
                    style={{ background: seatColor(seat).hex }}
                  />
                  {names(seat)}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm" data-testid="trade-recipient-fixed">
            {t("dialogs.trade.onlyTo", { name: names(active) })}
          </p>
        )}
        {isActive && to.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{t("dialogs.trade.recipientsHint")}</p>
        )}
      </fieldset>

      <p className="mt-2 text-xs text-muted-foreground" role="status" data-testid="trade-summary">
        {complete
          ? t("dialogs.trade.summary", { give: formatBundle(give, t), get: formatBundle(get, t) })
          : t("dialogs.trade.incomplete")}
      </p>

      <DialogFooter>
        <Button variant="secondary" onClick={() => openDialog(null)}>
          {t("dialogs.trade.close")}
        </Button>
        <Button
          disabled={!ok}
          onClick={() => {
            if (act({ type: "proposeTrade", give, get, to })) openDialog(null);
          }}
        >
          {t("dialogs.trade.send")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Always mounted; opens when the ui dialog is "trade" with a draft. */
export function TradePanel() {
  const view = useView();
  const own = useOwn();
  const open = useUiStore((s) => s.dialog === "trade");
  const draft = useUiStore((s) => s.tradeDraft);
  if (!open || !draft || !view || view.viewer === null || !own?.resources) return null;
  const viewer = view.viewer;
  const opponents = view.players.map((_, i) => i).filter((s) => s !== viewer);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) openDialog(null);
      }}
    >
      <Composer
        key={draft.id}
        draft={draft}
        hand={own.resources}
        viewer={viewer}
        active={view.turn.seat}
        opponents={opponents}
      />
    </Dialog>
  );
}
