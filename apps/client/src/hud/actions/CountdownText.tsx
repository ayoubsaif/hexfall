// Countdown as stepped text (specs/game-hud "Turn countdown"): "38 s" on screen, "38 seconds
// left" for assistive tech, warning color in the last 10 seconds. It changes at most once per
// second (hud/countdown.ts) and has no transition or animation.
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { type Countdown, countdownText } from "../countdown.ts";

export function CountdownText({
  countdown,
  className,
}: {
  countdown: Countdown;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      data-testid="countdown"
      data-warning={countdown.warning || undefined}
      className={cn(
        "font-semibold whitespace-nowrap text-hud-fg tabular-nums data-[warning]:text-bad",
        className,
      )}
    >
      <span aria-hidden="true">{countdown.secondsLeft} s</span>
      <span className="sr-only">{countdownText(countdown.secondsLeft, t)}</span>
    </span>
  );
}
