// Splash screen (openspec settlecoast-parchment-ui, "Splash screen"): shown while the theme
// manifest, models and textures load. App unmounts it once the board reports it is ready.
import { Pause, Play, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../store/motion.ts";

export const TIP_COUNT = 5;
export const TIP_INTERVAL_MS = 6000;
export const GAME_NAME = import.meta.env.VITE_GAME_NAME || "Hexfall";
/** Watercolor island (the rules "goal" picture); edges fade into the parchment. Same picture
 * as the first-paint #boot screen in index.html, so the hand-off does not jump. */
function Art() {
  return (
    <img
      src="/rules/goal.webp"
      alt=""
      aria-hidden="true"
      width={960}
      height={540}
      data-testid="splash-art"
      className="splash-art h-auto w-[min(30rem,100%)] short:w-[min(18rem,100%)]"
    />
  );
}

export function Splash({ progress }: { progress?: number }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const [tip, setTip] = useState(0);
  const [paused, setPaused] = useState(false);
  const rotating = !paused && !reduced;
  useEffect(() => {
    if (!rotating) return;
    const id = setInterval(() => setTip((n) => (n + 1) % TIP_COUNT), TIP_INTERVAL_MS);
    return () => clearInterval(id);
  }, [rotating, tip]);
  const key = `t${tip + 1}` as "t1" | "t2" | "t3" | "t4" | "t5";
  return (
    <div
      className="paper paper-solid pointer-events-auto absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 overflow-auto p-8 text-center"
      data-testid="splash"
      role="status"
    >
      <div className="pointer-events-none absolute inset-3 border border-gold/70" />
      <div className="pointer-events-none absolute inset-4 border border-gold/40" />
      <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.25em] text-gold uppercase">
        <span className="h-px w-10 bg-gold/70" />
        {t("session.splash.eyebrow")}
        <span className="h-px w-10 bg-gold/70" />
      </p>
      <h1 className="font-serif text-6xl font-semibold text-forest max-sm:text-5xl">{GAME_NAME}</h1>
      <p className="font-serif text-xl text-ink-muted">{t("session.splash.tagline")}</p>
      <Art />
      <p className="text-sm font-semibold">{t("session.splash.loading")}</p>
      <div
        className="h-1 w-72 max-w-full overflow-hidden rounded-full bg-ink/20"
        role="progressbar"
        aria-label={t("session.splash.progress")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress === undefined ? undefined : Math.round(progress * 100)}
      >
        <div
          className={
            progress === undefined
              ? "h-full w-1/3 rounded-full bg-gold motion-safe:animate-pulse"
              : "h-full rounded-full bg-gold"
          }
          style={progress === undefined ? undefined : { width: `${progress * 100}%` }}
        />
      </div>
      <section
        className="mt-2 flex w-[min(30rem,100%)] flex-col gap-1 text-left"
        aria-label={t("session.splash.fieldGuide")}
      >
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-[0.15em] text-gold uppercase">
          <span>{t("session.splash.fieldGuide")}</span>
          <span className="flex items-center gap-1.5">
            <span data-testid="splash-count" className="tracking-widest tabular-nums">
              {t("session.splash.tipCount", { n: tip + 1, total: TIP_COUNT })}
            </span>
            <button
              type="button"
              className="pointer-events-auto grid size-10 place-items-center rounded-full border border-gold/60 text-leather outline-none hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={paused ? t("session.splash.resume") : t("session.splash.pause")}
              aria-pressed={paused}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </button>
            <button
              type="button"
              className="pointer-events-auto grid size-10 place-items-center rounded-full border border-gold/60 text-leather outline-none hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("session.splash.next")}
              onClick={() => setTip((n) => (n + 1) % TIP_COUNT)}
            >
              <ArrowRight className="size-4" />
            </button>
          </span>
        </div>
        <h2 className="font-serif text-2xl font-semibold" data-testid="splash-tip">
          {t(`session.splash.tips.${key}.title`)}
        </h2>
        <p className="text-sm text-ink-muted">{t(`session.splash.tips.${key}.body`)}</p>
      </section>
    </div>
  );
}
