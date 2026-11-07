// The dice tray (specs/game-hud "Dice display", "Your-turn focus", "Turn countdown"; openspec
// dice-tray-3d, design decisions 4–5; floating-hud-turn-timer, design decision 8;
// physics-dice-3d, design decision 9): the Roll dice / Roll for order control, docked at the
// bottom-right of the board area, or enlarged at the center of the screen while the your-turn
// focus is open. It is drawn only while the viewer has a roll to make; the 3D dice on the
// board (scene/dice/BoardDice.tsx) show every roll's values, so the tray draws no total. It
// still announces each roll, as text, when the board dice come to rest.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Seat } from "@hexfall/engine";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { THROW_MS, useDiceThrow } from "../../game/diceThrow.ts";
import { controlsOf, latestRoll, type DiceRoll } from "../../game/status.ts";
import type { T } from "../../i18n/index.ts";
import { act } from "../../net/actions.ts";
import { useGameStore } from "../../store/game.ts";
import { useDiceStore } from "../../store/dice.ts";
import { useDockStore } from "../../store/dock.ts";
import { setTurnFocus, useUiStore } from "../../store/ui.ts";
import { hotkeyLabel } from "../../hotkeys/registry.ts";
import { DiceArt } from "./DiceArt.tsx";
import { prefersReducedMotion } from "../cards/useCountChange.ts";
import { countdownText, useCountdown } from "../countdown.ts";
import { useInFlight, useLegal, useView } from "../state.ts";

export { THROW_MS };

/** "Rolled 3 and 4, total 7", or the no-roll text. */
export function rollText(dice: readonly [number, number] | null, t: T): string {
  if (!dice) return t("play.dice.noRoll");
  const [a, b] = dice;
  return t("play.dice.rolled", { a, b, total: a + b });
}

/** Move between the dock and the center (hud-presentation "Minimal motion": at most 200 ms). */
export const MOVE_MS = 200;

/**
 * Default `onSettled`: a roll by or for the viewer (their own roll, or the timer's) has come
 * to rest, so the your-turn focus closes.
 */
export function closeFocusOnOwnRoll(roll: DiceRoll, viewer: Seat | null): void {
  if (viewer !== null && roll.seat === viewer && useUiStore.getState().focus === "open") {
    setTurnFocus("closed");
  }
}

export interface DiceTrayProps {
  /** Called once per new roll when its dice come to rest (at once for a static roll). */
  onSettled?: (roll: DiceRoll, viewer: Seat | null) => void;
}

/** Mount while a game view is present. */
export function DiceTray({ onSettled = closeFocusOnOwnRoll }: DiceTrayProps = {}) {
  const view = useView();
  const legal = useLegal();
  const inFlight = useInFlight();
  const log = useGameStore((s) => s.log);
  const dock = useDockStore();
  const centered = useUiStore((s) => s.focus === "open");
  const countdown = useCountdown();
  const { t } = useTranslation();
  const roll = latestRoll(log);
  const thrown = useDiceThrow(roll);
  const boardSettled = useDiceStore((s) => roll !== null && s.settledIndex === roll.index);
  const [timedOutKey, setTimedOutKey] = useState(-1);
  const settled = thrown.mode === "static" || boardSettled || timedOutKey === thrown.key;
  const moveRef = useRef<HTMLDivElement>(null);
  const lastRect = useRef<DOMRect | null>(null);
  const viewer = view?.viewer ?? null;
  const rollIndex = roll?.index ?? null;
  // The roll present at mount is already at rest: only later rolls report settling.
  const reported = useRef(rollIndex);

  // Fallback if the board dice never report rest (hidden tab, no WebGL).
  useEffect(() => {
    if (thrown.mode !== "animate") return;
    const id = setTimeout(() => setTimedOutKey(thrown.key), THROW_MS + 250);
    return () => clearTimeout(id);
  }, [thrown]);

  useEffect(() => {
    const r = latestRoll(log);
    if (!settled || !r || r.index === reported.current) return;
    reported.current = r.index;
    onSettled(r, viewer);
  }, [settled, log, viewer, onSettled]);

  // FLIP: the same element moves between dock and center, so its throw state and keyboard
  // focus survive; the move itself is a 200 ms translate/scale on an inner wrapper.
  useLayoutEffect(() => {
    const el = moveRef.current;
    if (!el) return;
    const next = el.getBoundingClientRect();
    const prev = lastRect.current;
    lastRect.current = next;
    if (!prev || next.width === 0 || prefersReducedMotion() || typeof el.animate !== "function") {
      return;
    }
    const dx = prev.left - next.left;
    const dy = prev.top - next.top;
    const s = prev.width / next.width;
    el.animate(
      [
        { transformOrigin: "top left", transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transformOrigin: "top left", transform: "none" },
      ],
      { duration: MOVE_MS, easing: "ease-out" },
    );
  }, [centered]);

  if (!view) return null;
  const c = controlsOf(view, legal, inFlight);
  const action = c.rollForOrder ? "rollForOrder" : c.rollDice ? "rollDice" : null;
  const text = rollText(roll?.dice ?? null, t);
  const name =
    action === "rollForOrder"
      ? t("play.dice.rollForOrder")
      : action === "rollDice"
        ? t("play.dice.rollDice")
        : text;
  // The viewer's own roll wait: the countdown sits on the dice (the focus shows it when open).
  const own =
    countdown && countdown.kind === "roll" && viewer !== null && countdown.seats.includes(viewer)
      ? countdown
      : null;
  const showCountdown = own !== null && action !== null && !centered;
  // Drawn only while there is a roll to make (the HUD stays as light as possible).
  const shown = action !== null;

  return (
    <div
      data-testid="dice-tray"
      data-centered={centered || undefined}
      data-shown={shown || undefined}
      className={cn(
        "pointer-events-auto",
        centered
          ? "fixed top-1/2 left-1/2 z-40 -translate-x-1/2 -translate-y-1/2 [--die:72px] max-sm:[--die:52px]"
          : "absolute z-10 [--die:32px] max-sm:[--die:26px] short:[--die:26px]",
      )}
      style={centered ? undefined : { right: dock.right, bottom: dock.bottom }}
    >
      <div
        ref={moveRef}
        hidden={!shown}
        className="relative motion-reduce:transition-none"
      >
        <button
          type="button"
          data-testid="dice"
          data-ready={action ? true : undefined}
          aria-label={name}
          aria-describedby={showCountdown ? "dice-countdown" : undefined}
          title={action ? `${name} (${hotkeyLabel("rollDice")})` : undefined}
          aria-keyshortcuts={action ? "Space r" : undefined}
          disabled={action === null}
          onClick={() => {
            if (action) act({ type: action });
          }}
          className={cn(
            "flex items-center bg-transparent p-1 outline-none",
            "transition-[translate,filter] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-leather",
            "data-[ready]:cursor-pointer data-[ready]:[filter:drop-shadow(0_0_6px_var(--color-wait))] data-[ready]:hover:-translate-y-0.5",
            "disabled:cursor-default",
          )}
        >
          <DiceArt
            dice={null}
            rolling={thrown.mode === "animate" && !settled}
            className="h-[calc(var(--die)*1.7)] w-[calc(var(--die)*2)] data-[rolling]:opacity-60"
          />
        </button>
        {showCountdown && (
          <span
            id="dice-countdown"
            data-testid="dice-countdown"
            data-warning={own.warning || undefined}
            className="pointer-events-none absolute -top-2 -left-2 hud-square px-1.5 py-0.5 text-xs font-semibold text-hud-fg tabular-nums shadow-md shadow-black/25 data-[warning]:text-bad"
          >
            <span aria-hidden="true">{own.secondsLeft}s</span>
            <span className="sr-only">{countdownText(own.secondsLeft, t)}</span>
          </span>
        )}
      </div>
      <span role="status" aria-live="polite" className="sr-only" data-testid="dice-announce">
        {settled && roll ? text : ""}
      </span>
    </div>
  );
}
