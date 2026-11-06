// Bank and harbor trade (specs/game-hud, "Maritime trade"). Never offers player trades.
// Presentation: specs/hud-presentation "Resource picture cards" (shadcn Dialog + GameCard).
import type { Resource } from "@hexfall/engine";
import { RESOURCES } from "@hexfall/engine/geometry";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog.tsx";
import { cn } from "@/lib/utils.ts";
import { canGive, isValidMaritime, maritimeMax } from "../game/cards.ts";
import { resourceLabel } from "../i18n/labels.ts";
import { act } from "../net/actions.ts";
import { openDialog, useUiStore } from "../store/ui.ts";
import { GameCard } from "./cards/GameCard.tsx";
import { useInFlight, useLegal, useOwn, useView } from "./state.ts";

/** One selectable card in a give/get row: a radio button wrapping a picture card. */
function CardChoice({
  resource,
  label,
  checked,
  disabled,
  onSelect,
  children,
}: {
  resource: Resource;
  label: string;
  checked: boolean;
  disabled: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      data-resource={resource}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "pointer-events-auto flex cursor-pointer flex-col items-center gap-1 rounded-none p-1 transition-transform duration-150 outline-none hover:-translate-y-1 focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0",
        checked && "bg-ink/10 ring-2 ring-primary",
      )}
    >
      <GameCard resource={resource} size="md" />
      {children}
    </button>
  );
}

/** Always mounted; opens when the ui dialog is "maritime" and the server gave rates. */
export function MaritimePanel() {
  const { t } = useTranslation();
  const view = useView();
  const legal = useLegal();
  const own = useOwn();
  const inFlight = useInFlight();
  const open = useUiStore((s) => s.dialog === "maritime");
  const [give, setGive] = useState<Resource | null>(null);
  const [get, setGet] = useState<Resource | null>(null);
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (!open) {
      setGive(null);
      setGet(null);
      setCount(1);
    }
  }, [open]);

  const rates = legal?.maritime ?? null;
  if (!open || !view || !rates || !own?.resources) return null;
  const hand = own.resources;
  const bank = view.bank;
  const max = give && get ? maritimeMax(hand, bank, rates, give, get) : 0;
  const ok = give !== null && get !== null && isValidMaritime(hand, bank, rates, give, get, count);

  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) openDialog(null);
      }}
    >
      <DialogContent title={t("dialogs.maritime.title")} className="w-[min(440px,calc(100%-32px))]">
        <fieldset className="mb-2">
          <legend className="mb-1 text-sm font-semibold">{t("dialogs.maritime.give")}</legend>
          <div
            role="radiogroup"
            aria-label={t("dialogs.maritime.give")}
            className="flex flex-wrap gap-1"
          >
            {RESOURCES.map((r) => {
              const able = canGive(hand, rates, r);
              return (
                <CardChoice
                  key={r}
                  resource={r}
                  label={t("dialogs.maritime.giveLabel", {
                    resource: resourceLabel(t, r),
                    rate: rates[r],
                    count: hand[r],
                  })}
                  checked={give === r}
                  disabled={!able}
                  onSelect={() => {
                    setGive(r);
                    if (get === r) setGet(null);
                    setCount(1);
                  }}
                >
                  <Badge variant="accent" data-rate>
                    {rates[r]}:1
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {t("dialogs.maritime.have", { count: hand[r] })}
                  </span>
                </CardChoice>
              );
            })}
          </div>
        </fieldset>
        <fieldset className="mb-2">
          <legend className="mb-1 text-sm font-semibold">{t("dialogs.maritime.get")}</legend>
          <div
            role="radiogroup"
            aria-label={t("dialogs.maritime.get")}
            className="flex flex-wrap gap-1"
          >
            {RESOURCES.map((r) => (
              <CardChoice
                key={r}
                resource={r}
                label={t("dialogs.maritime.getLabel", {
                  resource: resourceLabel(t, r),
                  count: bank[r],
                })}
                checked={get === r}
                disabled={r === give || bank[r] === 0}
                onSelect={() => {
                  setGet(r);
                  setCount(1);
                }}
              >
                <span className="text-[11px] text-muted-foreground">
                  {t("dialogs.maritime.bank", { count: bank[r] })}
                </span>
              </CardChoice>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <span>{t("dialogs.maritime.howMany")}</span>
          <input
            type="number"
            min={1}
            max={Math.max(1, max)}
            value={count}
            disabled={max === 0}
            onChange={(e) => setCount(Math.max(1, Math.floor(Number(e.target.value) || 1)))}
            className="pointer-events-auto w-16 rounded-none border border-border bg-cream/70 px-2 py-1 text-foreground disabled:opacity-50"
          />
        </label>
        {give && get && (
          <p className="mt-2 text-xs text-muted-foreground" role="status">
            {ok
              ? t("dialogs.maritime.summary", {
                  giveCount: count * rates[give],
                  give: resourceLabel(t, give),
                  getCount: count,
                  get: resourceLabel(t, get),
                })
              : max === 0
                ? t("dialogs.maritime.impossible")
                : t("dialogs.maritime.atMost", { max })}
          </p>
        )}
        <DialogFooter>
          <Button variant="secondary" onClick={() => openDialog(null)}>
            {t("dialogs.maritime.close")}
          </Button>
          <Button
            disabled={!ok || inFlight}
            onClick={() => {
              if (give && get && act({ type: "maritimeTrade", give, get, count })) openDialog(null);
            }}
          >
            {t("dialogs.maritime.trade")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
