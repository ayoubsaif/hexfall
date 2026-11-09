// Tutorial rule helper (openspec tutorial-mode-and-rules-guide, specs/tutorial-mode "Rule helpers
// on game controls"; design decision 3). Off: the trigger renders unchanged. On: it opens a hover
// card with what the action does, its cost, the rules that limit it and, when it is off, why.
import type { ReactElement } from "react";
import { useTranslation } from "react-i18next";
import { HoverCard } from "@/components/ui/hover-card.tsx";
import { cn } from "@/lib/utils.ts";
import { useTutorial } from "../../store/tutorial.ts";
import { type Blocker, blockerText } from "../../tutorial/blockers.ts";
import { type Topic, ruleLines, topicInfo } from "../../tutorial/topics.ts";
import { CostCards } from "../actions/ActionButtons.tsx";

/** The hover card body for a topic. */
export function TopicCard({ topic, blocker }: { topic: Topic; blocker?: Blocker | null }) {
  const { t } = useTranslation();
  const info = topicInfo(topic);
  return (
    <div className="flex flex-col gap-1.5" data-testid="tutorial-help" data-topic={topic}>
      <p className="m-0 font-semibold">{t(info.title)}</p>
      <p className="m-0">{t(info.body)}</p>
      {info.cost && (
        <div className="flex items-center gap-2 text-xs" data-tutorial-cost>
          <span className="text-muted-foreground">{t("tutorial.ui.costLabel")}</span>
          <CostCards cost={info.cost} />
        </div>
      )}
      <ul className="m-0 list-disc space-y-0.5 pl-4 text-xs">
        {ruleLines(t(info.rules)).map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      {blocker && (
        <p data-tutorial-blocker={blocker.key} className="m-0 text-xs font-semibold text-bad">
          {blockerText(blocker, t)}
        </p>
      )}
    </div>
  );
}

/** Wraps one trigger element with the topic's rule helper while tutorial mode is on. */
export function TutorialHelp({
  topic,
  blocker,
  side,
  children,
}: {
  topic: Topic;
  blocker?: Blocker | null;
  side?: "top" | "right" | "bottom" | "left";
  children: ReactElement;
}) {
  const enabled = useTutorial((s) => s.enabled);
  if (!enabled) return children;
  return (
    <HoverCard
      content={<TopicCard topic={topic} blocker={blocker ?? null} />}
      {...(side ? { side } : {})}
    >
      {children}
    </HoverCard>
  );
}

/** A small "?" button that opens the topic's rule helper; nothing while tutorial mode is off. */
export function HelpMark({ topic, className }: { topic: Topic; className?: string }) {
  const { t } = useTranslation();
  const enabled = useTutorial((s) => s.enabled);
  if (!enabled) return null;
  return (
    <HoverCard content={<TopicCard topic={topic} />} side="bottom">
      <button
        type="button"
        data-testid={`tutorial-help-${topic}`}
        aria-label={t("tutorial.ui.help")}
        className={cn(
          "ml-2 inline-grid size-5 cursor-help place-items-center rounded-full border border-current align-middle text-xs leading-none font-semibold opacity-70 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        ?
      </button>
    </HoverCard>
  );
}
