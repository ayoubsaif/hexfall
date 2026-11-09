// Modal choices: discard, Year of Plenty, Monopoly, robber victim (specs/game-hud,
// specs/board-interaction "Robber move and victim choice"). Presentation:
// specs/hud-presentation "Resource picture cards" (shadcn Dialog + GameCard).
import type { Resource, ResourceBundle } from "@hexfall/engine";
import { RESOURCES } from "@hexfall/engine/geometry";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog.tsx";
import {
  canAddYearOfPlenty,
  compact,
  isValidDiscard,
  isValidYearOfPlenty,
  total,
  yearOfPlentyCount,
} from "../game/cards.ts";
import { seatColor, seatColorName } from "../game/colors.ts";
import { act } from "../net/actions.ts";
import { openDialog, setVictimHex, useUiStore } from "../store/ui.ts";
import { CountdownText } from "./actions/CountdownText.tsx";
import { GameCard } from "./cards/GameCard.tsx";
import { Stepper } from "./cards/Stepper.tsx";
import { useCountdown } from "./countdown.ts";
import { useNames } from "./names.ts";
import { HelpMark } from "./tutorial/TutorialHelp.tsx";
import { useInFlight, useLegal, useOwn, useView } from "./state.ts";

/** Blocks Escape and outside clicks for dialogs that must be answered. */
const mandatory = {
  onEscapeKeyDown: (e: Event) => e.preventDefault(),
  onPointerDownOutside: (e: Event) => e.preventDefault(),
  onInteractOutside: (e: Event) => e.preventDefault(),
};

/** Always mounted; opens by itself when the viewer owes a discard. Cannot be dismissed. */
export function DiscardDialog() {
  const { t } = useTranslation();
  const viewer = useView()?.viewer ?? null;
  const countdown = useCountdown();
  const legal = useLegal();
  const own = useOwn();
  const inFlight = useInFlight();
  const owed = legal?.discard ?? 0;
  const [chosen, setChosen] = useState<ResourceBundle>({});
  useEffect(() => {
    if (owed === 0) setChosen({});
  }, [owed]);
  if (owed <= 0 || !own?.resources) return null;
  const hand = own.resources;
  const picked = total(chosen);
  const ok = isValidDiscard(hand, chosen, owed);
  return (
    <Dialog open>
      <DialogContent
        title={t("dialogs.discard.title", { count: owed })}
        description={t("dialogs.discard.description", { picked, owed })}
        {...mandatory}
      >
        {RESOURCES.map((r) => (
          <Stepper
            key={r}
            resource={r}
            value={chosen[r] ?? 0}
            note={t("dialogs.stepper.youHave", { count: hand[r] })}
            canAdd={(chosen[r] ?? 0) < hand[r] && picked < owed}
            onChange={(n) => setChosen({ ...chosen, [r]: n })}
          />
        ))}
        <DialogFooter>
          {countdown && viewer !== null && countdown.seats.includes(viewer) && (
            <CountdownText countdown={countdown} className="mr-auto self-center" />
          )}
          <HelpMark topic="discard" className="self-center" />
          <Button
            disabled={!ok || inFlight}
            onClick={() => act({ type: "discard", cards: compact(chosen) })}
          >
            {t("dialogs.discard.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const closeOnDismiss = (open: boolean) => {
  if (!open) openDialog(null);
};

/** Always mounted; opens when the ui dialog is "yearOfPlenty" and the card is playable. */
export function YearOfPlentyDialog() {
  const { t } = useTranslation();
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();
  const open = useUiStore((s) => s.dialog === "yearOfPlenty");
  const [picks, setPicks] = useState<Resource[]>([]);
  useEffect(() => {
    if (!open) setPicks([]);
  }, [open]);
  if (!open || !view || !legal?.playDevCard.includes("yearOfPlenty")) return null;
  const bank = view.bank;
  const need = yearOfPlentyCount(bank);
  const count = (r: Resource) => picks.filter((p) => p === r).length;
  const setCount = (r: Resource, n: number) =>
    setPicks([...picks.filter((p) => p !== r), ...Array<Resource>(n).fill(r)]);
  return (
    <Dialog open onOpenChange={closeOnDismiss}>
      <DialogContent
        title={t("dialogs.yearOfPlenty.title")}
        description={t("dialogs.yearOfPlenty.description", { count: need })}
      >
        {RESOURCES.map((r) => (
          <Stepper
            key={r}
            resource={r}
            value={count(r)}
            note={t("dialogs.stepper.bankHas", { count: bank[r] })}
            canAdd={canAddYearOfPlenty(bank, picks, r)}
            onChange={(n) => setCount(r, n)}
          />
        ))}
        <DialogFooter>
          <Button variant="secondary" onClick={() => openDialog(null)}>
            {t("dialogs.cancel")}
          </Button>
          <Button
            disabled={!isValidYearOfPlenty(bank, picks) || inFlight}
            onClick={() => {
              if (act({ type: "playYearOfPlenty", resources: picks })) openDialog(null);
            }}
          >
            {t("dialogs.yearOfPlenty.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Always mounted; opens when the ui dialog is "monopoly" and the card is playable. */
export function MonopolyDialog() {
  const { t } = useTranslation();
  const legal = useLegal();
  const inFlight = useInFlight();
  const open = useUiStore((s) => s.dialog === "monopoly");
  if (!open || !legal?.playDevCard.includes("monopoly")) return null;
  return (
    <Dialog open onOpenChange={closeOnDismiss}>
      <DialogContent
        title={t("dialogs.monopoly.title")}
        description={t("dialogs.monopoly.description")}
      >
        {/* One activation names the resource and plays the card (unchanged behavior). */}
        <div
          role="group"
          aria-label={t("dialogs.monopoly.group")}
          className="flex flex-wrap gap-2 py-1"
        >
          {RESOURCES.map((r) => (
            <GameCard
              key={r}
              resource={r}
              size="md"
              disabled={inFlight}
              onClick={() => {
                if (act({ type: "playMonopoly", resource: r })) openDialog(null);
              }}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => openDialog(null)}>
            {t("dialogs.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Always mounted; opens when the board set `victimHex` for a hex with several victims. */
export function VictimDialog() {
  const { t } = useTranslation();
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();
  const hex = useUiStore((s) => s.victimHex);
  const names = useNames();
  if (hex === null || !view || !legal) return null;
  const option = legal.moveRobber.find((o) => o.hex === hex);
  if (!option) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) setVictimHex(null);
      }}
    >
      <DialogContent title={t("dialogs.victim.title")}>
        <ul className="flex flex-col gap-1.5">
          {option.victims.map((seat) => {
            const c = seatColor(seat);
            const cards = view.players[seat]?.resourceCount ?? 0;
            return (
              <li key={seat}>
                <Button
                  variant="secondary"
                  data-testid="victim-option"
                  className="w-full justify-start"
                  disabled={inFlight}
                  onClick={() => {
                    if (act({ type: "moveRobber", hex, victim: seat })) setVictimHex(null);
                  }}
                >
                  <span
                    className="size-3 rounded-sm"
                    style={{ background: c.hex }}
                    title={seatColorName(seat, t)}
                  />
                  <span>{names(seat)}</span>
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    {t("dialogs.victim.cards", { count: cards })}
                  </span>
                </Button>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <HelpMark topic="robber" className="mr-auto self-center" />
          <Button variant="secondary" onClick={() => setVictimHex(null)}>
            {t("dialogs.victim.pickAnother")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
