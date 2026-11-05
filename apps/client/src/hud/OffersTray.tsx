// Open player-trade offers that involve the viewer (specs/player-trade "Open offers tray",
// "Incoming offer notification"). Reads `view.offers`; buttons enable from the legal offer ids.
import type { ResourceBundle, Seat, TradeOffer } from "@hexfall/engine";
import { RESOURCES } from "@hexfall/engine/geometry";
import { ArrowLeftRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { cn } from "@/lib/utils.ts";
import { formatBundle, offerSidesFor, swapForCounter } from "../game/cards.ts";
import { seatColor } from "../game/colors.ts";
import { act } from "../net/actions.ts";
import { openTrade } from "../store/ui.ts";
import { GameCard } from "./cards/GameCard.tsx";
import { useNames } from "./names.ts";
import { useInFlight, useLegal, useOwn, useView } from "./state.ts";

/** How long a newly arrived offer stays highlighted. */
export const FRESH_MS = 2000;

/** Offers from the viewer, or to the viewer and not yet declined by them, oldest first. */
export function visibleOffers(offers: readonly TradeOffer[], viewer: Seat): TradeOffer[] {
  return offers
    .filter((o) => o.from === viewer || (o.to.includes(viewer) && !o.rejectedBy.includes(viewer)))
    .sort((a, b) => a.id - b.id);
}

/**
 * Ids of incoming offers that arrived after mount, for a short highlight. Offers already open
 * when the tray mounts (join, resume) are only remembered.
 */
function useFreshOffers(ids: readonly number[]): readonly number[] {
  const seen = useRef<Set<number> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [fresh, setFresh] = useState<number[]>([]);
  const key = ids.join(",");
  useEffect(() => {
    if (seen.current === null) {
      seen.current = new Set(ids);
      return;
    }
    const known = seen.current;
    const added = ids.filter((id) => !known.has(id));
    for (const id of added) known.add(id);
    if (added.length === 0) return;
    setFresh((f) => [...f, ...added]);
    timers.current.push(
      setTimeout(() => setFresh((f) => f.filter((id) => !added.includes(id))), FRESH_MS),
    );
    // `key` stands for `ids`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  return fresh;
}

/** One side of an offer as small cards; decorative (the entry has a text equivalent). */
function Side({ label, bundle }: { label: string; bundle: ResourceBundle }) {
  return (
    <div className="flex items-center gap-2" aria-hidden="true">
      <span className="w-[7ch] shrink-0 text-xs text-muted-foreground">{label}</span>
      <span className="flex flex-wrap gap-1">
        {RESOURCES.filter((r) => (bundle[r] ?? 0) > 0).map((r) => (
          <span key={r} className="flex items-center gap-0.5" data-side-resource={r}>
            <GameCard resource={r} size="sm" />
            <span className="text-xs font-semibold tabular-nums">×{bundle[r]}</span>
          </span>
        ))}
      </span>
    </div>
  );
}

function Swatch({ seat }: { seat: Seat }) {
  return (
    <span
      aria-hidden="true"
      className="size-2.5 shrink-0 rounded-sm"
      style={{ background: seatColor(seat).hex }}
    />
  );
}

/** Mount while a game view is present. Renders nothing when no offer involves the viewer. */
export function OffersTray() {
  const { t } = useTranslation();
  const view = useView();
  const legal = useLegal();
  const own = useOwn();
  const inFlight = useInFlight();
  const names = useNames();
  const [expanded, setExpanded] = useState(false);
  const viewer = view?.viewer ?? null;
  const offers = view && viewer !== null ? visibleOffers(view.offers, viewer) : [];
  const fresh = useFreshOffers(offers.filter((o) => o.from !== viewer).map((o) => o.id));

  if (!view || viewer === null || view.winner !== null || !legal) return null;
  const active = view.turn.seat;
  const makeOffer = viewer !== active && legal.proposeTrade;
  if (offers.length === 0 && !makeOffer) return null;

  const makeOfferButton = makeOffer && (
    <Button
      size="sm"
      variant="secondary"
      data-testid="make-offer"
      disabled={inFlight}
      onClick={() => openTrade({ give: {}, get: {}, to: [active] })}
      className="pointer-events-auto self-start bg-hud backdrop-blur-md"
    >
      <ArrowLeftRight aria-hidden="true" />
      {t("play.offers.makeOffer", { name: names(active) })}
    </Button>
  );

  if (offers.length === 0) {
    return (
      <div className="flex flex-col" data-testid="offers-tray">
        {makeOfferButton}
      </div>
    );
  }

  return (
    <section
      aria-label={t("play.offers.title")}
      data-testid="offers-tray"
      className="flex max-h-[45vh] flex-col gap-1.5"
    >
      <Button
        size="sm"
        variant="secondary"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
        className="pointer-events-auto self-start bg-hud backdrop-blur-md sm:hidden"
      >
        <ArrowLeftRight aria-hidden="true" />
        {expanded ? t("play.offers.hide") : t("play.offers.show", { count: offers.length })}
      </Button>
      <ol
        className={cn(
          "m-0 flex min-h-0 list-none flex-col gap-1.5 overflow-y-auto p-0",
          !expanded && "max-sm:hidden",
        )}
      >
        {offers.map((o) => {
          const mine = o.from === viewer;
          const sides = offerSidesFor(viewer, o);
          const text = t("play.offers.sides", {
            give: formatBundle(sides.give, t),
            get: formatBundle(sides.get, t),
          });
          const canAccept = legal.acceptTrade.includes(o.id);
          const canReject = legal.rejectTrade.includes(o.id);
          return (
            <li
              key={o.id}
              data-testid="offer"
              data-offer={o.id}
              data-mine={mine || undefined}
              data-fresh={fresh.includes(o.id) || undefined}
              className={cn(
                "pointer-events-auto flex flex-col gap-1 rounded-xl border-l-4 bg-hud px-3 py-2 shadow-lg shadow-black/25 backdrop-blur-md transition-shadow",
                fresh.includes(o.id) && "ring-2 ring-wait",
              )}
              style={{ borderLeftColor: seatColor(o.from).hex }}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold">
                <Swatch seat={o.from} />
                {mine ? t("play.offers.yours") : t("play.offers.from", { name: names(o.from) })}
              </div>
              <Side label={t("play.offers.youGive")} bundle={sides.give} />
              <Side label={t("play.offers.youGet")} bundle={sides.get} />
              <p className="sr-only" data-testid="offer-text">
                {text}
              </p>
              {mine ? (
                <ul className="m-0 flex list-none flex-wrap gap-x-3 p-0 text-xs text-muted-foreground">
                  {o.to.map((seat) => (
                    <li key={seat} data-recipient={seat} className="flex items-center gap-1">
                      <Swatch seat={seat} />
                      {t("play.offers.recipient", {
                        name: names(seat),
                        state: o.rejectedBy.includes(seat)
                          ? t("play.offers.declined")
                          : t("play.offers.deciding"),
                      })}
                    </li>
                  ))}
                </ul>
              ) : (
                !canAccept &&
                canReject && (
                  <p className="text-xs text-muted-foreground" data-testid="offer-lacking">
                    {t("play.offers.lacking")}
                  </p>
                )
              )}
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {mine ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={inFlight || !legal.cancelTrade.includes(o.id)}
                    onClick={() => act({ type: "cancelTrade", offerId: o.id })}
                  >
                    {t("play.offers.cancel")}
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      disabled={inFlight || !canAccept}
                      onClick={() => act({ type: "acceptTrade", offerId: o.id })}
                    >
                      {t("play.offers.accept")}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={inFlight || !canReject}
                      onClick={() => act({ type: "rejectTrade", offerId: o.id })}
                    >
                      {t("play.offers.reject")}
                    </Button>
                    {legal.proposeTrade && own?.resources && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={inFlight}
                        onClick={() =>
                          openTrade({
                            ...swapForCounter(o, own.resources!),
                            to: [o.from],
                          })
                        }
                      >
                        {t("play.offers.counter")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {makeOfferButton}
    </section>
  );
}
