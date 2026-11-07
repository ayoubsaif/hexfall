// First screen: game-mode choices, with an optional guide to rules and building costs. Shown once
// per visit before the start screen, unless an invite link, a notice or a returning player skips it.
import { COSTS } from "@hexfall/engine/geometry";
import type { ResourceBundle } from "@hexfall/engine";
import { Download } from "lucide-react";
import { useTranslation } from "react-i18next";
import { GameModeButtons, type GameMode } from "./GameModeButtons.tsx";
import { promptInstall, useCanInstall } from "../pwa/install.ts";
import { CostCards } from "./actions/ActionButtons.tsx";

/** Module flag: the welcome screen was dismissed in this page visit. */
let dismissed = false;
export const welcomeDismissed = (): boolean => dismissed;
export const dismissWelcome = (): void => {
  dismissed = true;
};
/** For tests. */
export const resetWelcome = (): void => {
  dismissed = false;
};

const LOGO = "/icons/icon-192.png";

const STEPS = ["s1", "s2", "s3"] as const;
const TIPS = ["t1", "t2", "t3"] as const;
const EXAMPLES: { key: "road" | "settlement" | "city" | "devCard"; cost: ResourceBundle }[] = [
  { key: "road", cost: COSTS.road },
  { key: "settlement", cost: COSTS.settlement },
  { key: "city", cost: COSTS.city },
  { key: "devCard", cost: COSTS.devCard },
];

export function Welcome({ onPlay }: { onPlay: (mode: GameMode) => void }) {
  const { t } = useTranslation();
  const canInstall = useCanInstall();
  return (
    <div data-testid="welcome" data-interactive className="welcome-sheet paper pointer-events-auto">
      <header className="welcome-brand">
        <img
          src={LOGO}
          alt=""
          aria-hidden="true"
          width={56}
          height={56}
          className="size-14 rounded-xl shadow-md shadow-black/30"
        />
        <div className="text-left">
          <h1 className="font-serif text-4xl leading-none font-semibold text-forest">Hexfall</h1>
          <p className="font-serif text-lg text-ink-muted">{t("session.start.tagline")}</p>
        </div>
      </header>

      <div className="welcome-hero">
        <div className="welcome-message">
          <p className="welcome-eyebrow">{t("session.welcome.eyebrow")}</p>
          <h2>{t("session.welcome.headline")}</h2>
          <p className="welcome-intro">{t("session.welcome.intro")}</p>

          <p className="welcome-reassurance">{t("session.welcome.reassurance")}</p>
        </div>
        <GameModeButtons onSelect={onPlay} />
      </div>

      {canInstall && (
        <button
          type="button"
          data-testid="install-app"
          data-interactive
          onClick={() => void promptInstall()}
          className="mx-auto flex cursor-pointer items-center gap-2 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/75 px-4 py-2 text-sm font-semibold text-[#f6ecd0] shadow-sm shadow-black/20 outline-none backdrop-blur-sm hover:bg-[#2a160b]/90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Download aria-hidden size={18} className="text-[#f0c860]" />
          {t("session.welcome.install")}
        </button>
      )}

      <details className="welcome-guide">
        <summary>{t("session.welcome.guide")}</summary>
        <div className="welcome-guide-content">
          <section className="w-full text-left" aria-label={t("session.welcome.howTitle")}>
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-gold uppercase">
              {t("session.welcome.howTitle")}
            </h2>
            <ol className="m-0 grid list-none grid-cols-3 gap-2 p-0 max-sm:grid-cols-1">
              {STEPS.map((k, i) => (
                <li key={k} className="flex items-start gap-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-leather text-xs font-semibold text-cream">
                    {i + 1}
                  </span>
                  <span>{t(`session.welcome.steps.${k}`)}</span>
                </li>
              ))}
            </ol>
          </section>

          <section className="w-full text-left" aria-label={t("session.welcome.cardsTitle")}>
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-gold uppercase">
              {t("session.welcome.cardsTitle")}
            </h2>
            <ul className="m-0 grid list-none grid-cols-4 gap-2 p-0 max-sm:grid-cols-2">
              {EXAMPLES.map(({ key, cost }) => (
                <li
                  key={key}
                  data-testid="welcome-example"
                  className="flex flex-col items-start gap-1 border border-ink/15 bg-cream/50 p-1.5"
                >
                  <span className="font-semibold">{t(`session.welcome.examples.${key}`)}</span>
                  <span className="flex flex-wrap gap-0.5">
                    <CostCards cost={cost} />
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="w-full text-left" aria-label={t("session.welcome.tipsTitle")}>
            <h2 className="mb-1 text-[11px] font-semibold tracking-[0.15em] text-gold uppercase">
              {t("session.welcome.tipsTitle")}
            </h2>
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0 text-ink-muted">
              {TIPS.map((k) => (
                <li key={k}>· {t(`session.welcome.tips.${k}`)}</li>
              ))}
            </ul>
          </section>
        </div>
      </details>
    </div>
  );
}
