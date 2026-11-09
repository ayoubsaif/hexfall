// Rules guide dialog (openspec tutorial-mode-and-rules-guide, specs/rules-guide; design
// decision 6): the base game rules in 10 illustrated sections, a section list (sidebar on
// wider screens, a picker on phones) and previous/next. Opening it never touches game state.
import { ChevronLeft, ChevronRight } from "lucide-react";
import { gameIcon } from "./GameIcon.tsx";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog.tsx";
import { SealIcon } from "@/components/ui/SealIcon.tsx";
import { cn } from "@/lib/utils.ts";
import { en } from "../i18n/locales/index.ts";
import { RulesVisual } from "./RulesVisuals.tsx";
import {
  RULES_SECTIONS,
  type RulesSection,
  closeRulesGuide,
  openRulesGuide,
  setRulesSection,
  useRulesGuideStore,
} from "../store/rulesGuide.ts";

type PointKey = `rules.section.goal.points.a`;

/** Point keys of a section, in catalog order (English is the source of the key set). */
function pointKeys(section: RulesSection): PointKey[] {
  return Object.keys(en.rules.section[section].points).map(
    (k) => `rules.section.${section}.points.${k}` as PointKey,
  );
}

/** Illustration path for a section (static, same origin; specs/rules-guide). */
export const rulesImage = (section: RulesSection) => `/rules/${section}.webp`;

export function RulesGuide() {
  const { t } = useTranslation();
  const open = useRulesGuideStore((s) => s.open);
  const section = useRulesGuideStore((s) => s.section);
  const [broken, setBroken] = useState<ReadonlySet<RulesSection>>(() => new Set());
  const index = RULES_SECTIONS.indexOf(section);
  const prev = RULES_SECTIONS[index - 1];
  const next = RULES_SECTIONS[index + 1];
  const name = (s: RulesSection) => t(`rules.section.${s}.title`);

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? openRulesGuide(section) : closeRulesGuide())}>
      <DialogContent
        title={t("rules.title")}
        description={t("rules.description")}
        hideHeader
        data-testid="rules-guide"
        className="flex h-[min(640px,calc(100dvh-32px))] w-[min(880px,calc(100%-32px))] overflow-hidden p-0 [--corner-size:32px] frame-corners"
      >
        <div className="flex min-h-0 flex-1">
          <nav
            aria-label={t("rules.sections")}
            className="hidden w-52 shrink-0 flex-col overflow-y-auto border-r border-border bg-ink/10 py-5 sm:flex"
          >
            <p className="mb-2 flex items-center gap-2 px-4 font-serif text-lg font-semibold text-forest">
              <RulesIcon aria-hidden className="size-6 shrink-0" />
              {t("rules.title")}
            </p>
            <ol className="flex flex-col">
              {RULES_SECTIONS.map((s, i) => (
                <li key={s}>
                  <button
                    type="button"
                    data-testid={`rules-nav-${s}`}
                    aria-current={s === section ? "page" : undefined}
                    onClick={() => setRulesSection(s)}
                    className={cn(
                      "flex min-h-9 w-full cursor-pointer items-baseline gap-2 px-4 py-1.5 text-left text-sm outline-none hover:bg-ink/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
                      s === section && "bg-ink/15 font-semibold text-forest",
                    )}
                  >
                    <span aria-hidden className="w-4 shrink-0 text-right text-xs opacity-60">
                      {i + 1}
                    </span>
                    <span>{name(s)}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex shrink-0 items-center gap-2 pt-3 pr-14 pl-4 sm:pt-5 sm:pl-6">
              <select
                aria-label={t("rules.sections")}
                data-testid="rules-picker"
                value={section}
                onChange={(e) => setRulesSection(e.target.value as RulesSection)}
                className="hud-field min-h-10 w-full min-w-0 px-2 py-1.5 font-serif text-base font-semibold sm:hidden"
              >
                {RULES_SECTIONS.map((s, i) => (
                  <option key={s} value={s}>
                    {`${i + 1}. ${name(s)}`}
                  </option>
                ))}
              </select>
              <h2
                data-testid="rules-section-title"
                className="hidden font-serif text-2xl font-semibold text-forest sm:block"
              >
                {name(section)}
              </h2>
            </header>
            <section
              aria-label={name(section)}
              data-testid={`rules-section-${section}`}
              className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-4 pt-3 pb-4 sm:px-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-start">
                <div className="relative h-24 w-full shrink-0 overflow-hidden border border-gold/50 bg-ink/10 sm:aspect-video sm:h-auto sm:w-52">
                  <img
                    key={section}
                    src={rulesImage(section)}
                    alt={t(`rules.section.${section}.alt`)}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    hidden={broken.has(section)}
                    data-testid="rules-image"
                    className="size-full object-cover"
                    onError={() => setBroken((b) => new Set(b).add(section))}
                  />
                </div>
                <p className="m-0 flex-1 font-semibold">{t(`rules.section.${section}.intro`)}</p>
              </div>
              <div className="mt-3">
                <RulesVisual section={section} />
              </div>
              <ul className="mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-snug">
                {pointKeys(section).map((k) => (
                  <li key={k}>{t(k)}</li>
                ))}
              </ul>
            </section>
            <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-2.5 sm:px-6">
              <Button
                variant="secondary"
                data-testid="rules-previous"
                disabled={prev === undefined}
                onClick={() => prev && setRulesSection(prev)}
              >
                <ChevronLeft aria-hidden />
                {t("rules.previous")}
              </Button>
              <span className="text-xs text-muted-foreground" aria-live="polite">
                {t("rules.step", { n: index + 1, total: RULES_SECTIONS.length })}
              </span>
              <Button
                variant="secondary"
                data-testid="rules-next"
                disabled={next === undefined}
                onClick={() => next && setRulesSection(next)}
              >
                {t("rules.next")}
                <ChevronRight aria-hidden />
              </Button>
            </footer>
          </main>
        </div>
        <DialogClose
          aria-label={t("rules.close")}
          data-testid="rules-close"
          className="absolute top-2 right-2 z-10 grid size-11 cursor-pointer place-items-center outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring max-sm:size-12"
        >
          <SealIcon className="size-full drop-shadow-md" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

/** Round HUD button that opens the guide ("How to play"); sits next to the Settings button. */
const RulesIcon = gameIcon("rules");

export function RulesButton() {
  const { t } = useTranslation();
  const open = useRulesGuideStore((s) => s.open);
  const label = t("rules.open");
  return (
    <button
      type="button"
      data-testid="rules-button"
      data-interactive
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={label}
      className="pointer-events-auto grid size-10 cursor-pointer place-items-center hud-leather-round transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:size-11 short:size-11 pointer-coarse:size-11 motion-reduce:transition-none"
      onClick={() => openRulesGuide()}
    >
      <RulesIcon aria-hidden className="size-6 shrink-0" />
    </button>
  );
}
