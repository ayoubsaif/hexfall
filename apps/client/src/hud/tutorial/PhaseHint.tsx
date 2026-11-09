// Tutorial phase hint (openspec tutorial-mode-and-rules-guide, specs/tutorial-mode "Phase hint";
// design decision 5): a small parchment card with what to do now, "Learn more" (rules guide at
// the matching section) and "Turn off tutorial". Desktop: in the top bar under the status pill.
// Phones: above the hand and the bottom-left controls, clear of the action buttons on the right.
// It collapses to a small chip for the rest of the page session (not stored in the cookie).
import { Info, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { create } from "zustand";
import { Button } from "@/components/ui/button.tsx";
import { openRulesGuide } from "../../store/rulesGuide.ts";
import { setTutorialEnabled, useTutorial } from "../../store/tutorial.ts";
import { hintOf } from "../../tutorial/hint.ts";
import { useView } from "../state.ts";

/** Collapsed for this page session. */
export const useHintCollapsed = create<{ collapsed: boolean }>(() => ({ collapsed: false }));
const setCollapsed = (collapsed: boolean) => useHintCollapsed.setState({ collapsed });

const PLACE =
  "pointer-events-auto max-sm:fixed max-sm:left-2 max-sm:bottom-[calc(var(--hand-h,72px)_+_var(--corner-h,0px)_+_64px)] max-sm:z-20";

/** Mount while a game view is present. Renders nothing while tutorial mode is off. */
export function PhaseHint() {
  const { t } = useTranslation();
  const view = useView();
  const enabled = useTutorial((s) => s.enabled);
  const collapsed = useHintCollapsed((s) => s.collapsed);
  if (!enabled || !view) return null;
  const hint = hintOf(view);
  if (!hint) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        data-testid="phase-hint-chip"
        data-interactive
        aria-label={t("tutorial.ui.expand")}
        title={t("tutorial.ui.expand")}
        onClick={() => setCollapsed(false)}
        className={`${PLACE} grid size-8 cursor-pointer place-items-center rounded-full border border-gold/70 bg-paper text-forest shadow-md shadow-black/30 outline-none focus-visible:ring-2 focus-visible:ring-ring`}
      >
        <Info aria-hidden className="size-4" />
      </button>
    );
  }

  const text =
    hint.count === undefined
      ? t(`tutorial.hint.${hint.key}`)
      : t(`tutorial.hint.${hint.key}`, { count: hint.count });
  return (
    <aside
      data-testid="phase-hint"
      data-hint={hint.key}
      data-interactive
      aria-label={t("tutorial.ui.title")}
      className={`${PLACE} relative w-[min(320px,calc(100vw-96px))] border border-gold/70 bg-paper px-3 py-2 pr-8 text-[13px] leading-snug text-foreground shadow-lg shadow-black/30 max-sm:w-[min(300px,calc(100vw-80px))]`}
    >
      <p className="m-0 text-[11px] font-semibold tracking-wide text-forest uppercase">
        {t("tutorial.ui.title")}
      </p>
      <p data-testid="phase-hint-text" className="m-0 mt-0.5" aria-live="polite">
        {text}
      </p>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
        <Button
          variant="link"
          size="sm"
          data-testid="phase-hint-learn"
          onClick={() => openRulesGuide(hint.rulesSection)}
        >
          {t("tutorial.ui.learnMore")}
        </Button>
        <Button
          variant="link"
          size="sm"
          data-testid="phase-hint-off"
          className="text-muted-foreground"
          onClick={() => setTutorialEnabled(false)}
        >
          {t("tutorial.ui.turnOff")}
        </Button>
      </div>
      <button
        type="button"
        data-testid="phase-hint-collapse"
        aria-label={t("tutorial.ui.collapse")}
        title={t("tutorial.ui.collapse")}
        onClick={() => setCollapsed(true)}
        className="absolute top-1 right-1 grid size-6 cursor-pointer place-items-center text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden className="size-4" />
      </button>
    </aside>
  );
}
