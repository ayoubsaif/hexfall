import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { HudRootContext } from "@/components/ui/hud-root.ts";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import type { ConnectionStatus } from "../net/connection.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useGameStore } from "../store/game.ts";
import { DEFAULT_DOCK, hudLayout, setDiceDock } from "../store/dock.ts";
import { useRoomStore } from "../store/room.ts";
import { BOARD_STYLES, useBoardStyle } from "../theme/index.ts";
import {
  ActionButtons,
  CountdownAnnouncer,
  CreditsButton,
  DiceTray,
  DiscardDialog,
  EventLog,
  GameOver,
  Hand,
  LanguageSwitch,
  Lobby,
  MaritimePanel,
  MonopolyDialog,
  PlayerPanels,
  Rejection,
  ReplacedNotice,
  StartScreen,
  StatusPill,
  Toasts,
  TurnFocus,
  VictimDialog,
  YearOfPlentyDialog,
} from "./index.ts";

const DOT: Record<ConnectionStatus, string> = {
  connecting: "bg-wait",
  open: "bg-ok",
  reconnecting: "bg-wait",
  closed: "bg-bad",
  version_mismatch: "bg-bad",
  replaced: "bg-wait",
};

/** Small pill, top right. Static dot: no HUD element animates continuously. */
function ConnectionBadge() {
  const { t } = useTranslation();
  const status = useConnectionStore((s) => s.status);
  const latencyMs = useConnectionStore((s) => s.latencyMs);
  const attempts = useConnectionStore((s) => s.attempts);
  const showPing = status === "open" && latencyMs !== null;
  return (
    <div
      className="absolute top-3 right-3 flex items-center gap-2 rounded-full bg-hud px-3 py-1.5 text-xs shadow-lg shadow-black/25 backdrop-blur-md max-sm:top-2 max-sm:right-2 short:top-2 short:right-2"
      data-status={status}
      role="status"
      aria-live="polite"
    >
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden="true" />
      <span data-testid="connection-status">{t(`session.hud.connection.${status}`)}</span>
      {showPing && (
        <span data-testid="connection-ping" className="text-muted-foreground tabular-nums">
          {Math.round(latencyMs)} ms
        </span>
      )}
      {status === "reconnecting" && attempts > 1 && (
        <span className="text-muted-foreground tabular-nums">
          {t("session.hud.tryCount", { count: attempts })}
        </span>
      )}
    </div>
  );
}

export function ReloadBanner() {
  const { t } = useTranslation();
  const mismatch = useConnectionStore((s) => s.status === "version_mismatch");
  if (!mismatch) return null;
  return (
    <div
      className="pointer-events-auto absolute top-14 left-1/2 z-30 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3.5 rounded-xl border border-primary bg-hud px-4 py-2.5 text-sm backdrop-blur-md"
      role="alert"
    >
      <span>{t("session.hud.newVersion")}</span>
      <Button onClick={() => window.location.reload()}>{t("session.hud.reload")}</Button>
    </div>
  );
}

/** Board style switch (specs/board-view, "Board style preference"). Applies immediately. */
export function BoardStyleSwitch() {
  const { t } = useTranslation();
  const { style, setStyle } = useBoardStyle();
  return (
    <div
      className="pointer-events-auto flex rounded-full bg-hud p-[3px] shadow-lg shadow-black/25 backdrop-blur-md"
      role="radiogroup"
      aria-label={t("session.hud.boardStyle")}
      data-interactive
    >
      {BOARD_STYLES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={style === s}
          className="min-h-9 min-w-13 cursor-pointer rounded-full px-3.5 font-semibold text-muted-foreground transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring aria-checked:bg-primary aria-checked:text-primary-foreground max-sm:min-h-10 short:min-h-10"
          onClick={() => setStyle(s)}
        >
          {t(`session.hud.style.${s}`)}
        </button>
      ))}
    </div>
  );
}

/** Layout CSS variables published on the root element by `useHudLayout`. */
const LAYOUT_VARS = ["--hand-h", "--hud-bottom", "--pill-bottom", "--pill-side"] as const;

/**
 * Measures the HUD and publishes (store/dock.ts `hudLayout`):
 * - `--hand-h`: the edge hand's full card height (the floating buttons and corner controls sit
 *   above it, so a raised card never covers them);
 * - `--hud-bottom`: viewport bottom to the top of the buttons, which places the side log;
 * - `--pill-bottom` / `--pill-side`: the status pill's place above the hand;
 * - the dice dock: left of the side log above the buttons (desktop), or left of the buttons
 *   above the hand.
 * The board is a full-screen background and is not resized around any of this.
 */
function useHudLayout(corner: HTMLElement | null) {
  const [hand, setHand] = useState<HTMLDivElement | null>(null);
  const [cluster, setCluster] = useState<HTMLDivElement | null>(null);
  const [aside, setAside] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!cluster) return;
    const root = document.documentElement;
    const update = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const handHeight = hand?.getBoundingClientRect().height ?? 0;
      // The buttons are positioned from --hand-h: set it before measuring them.
      root.style.setProperty("--hand-h", `${Math.ceil(handHeight)}px`);
      const c = cluster.getBoundingClientRect();
      const a = aside?.getBoundingClientRect() ?? null;
      const k = corner?.getBoundingClientRect() ?? null;
      // The corner controls only stand above the hand when they sit in the lower half.
      const cornerHeight = k && k.top > height / 2 ? k.height : 0;
      const layout = hudLayout({
        width,
        height,
        handHeight,
        cluster: { left: c.left, top: c.top },
        aside: a ? { left: a.left, width: a.width } : null,
        cornerHeight,
      });
      root.style.setProperty("--hud-bottom", `${layout.hudBottom}px`);
      root.style.setProperty("--pill-bottom", `${layout.pillBottom}px`);
      root.style.setProperty("--pill-side", `${layout.pillSide}px`);
      setDiceDock(layout.dock);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    for (const el of [hand, cluster, aside, corner]) if (el) observer?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      for (const v of LAYOUT_VARS) root.style.removeProperty(v);
      setDiceDock(DEFAULT_DOCK);
    };
  }, [hand, cluster, aside, corner]);
  return { setHand, setCluster, setAside };
}

/**
 * In-game HUD (specs/hud-presentation "Responsive HUD layout"; design decisions 6, 7 and 9):
 * - the hand peeks from the bottom edge at the center, with no panel;
 * - the floating action buttons sit at the bottom-right, above the raised hand;
 * - the status pill floats above the hand;
 * - desktop (>= 1024 px wide and >= 600 px high): side log always visible; tablet, mobile and
 *   short screens open the log as a drawer and get compact panels.
 */
function GameHud({ corner }: { corner: HTMLElement | null }) {
  const { t } = useTranslation();
  const [logOpen, setLogOpen] = useState(false);
  const { setHand, setCluster, setAside } = useHudLayout(corner);
  return (
    <>
      <div className="absolute top-3 right-[170px] left-3 desktop:right-[400px] max-lg:right-[150px] max-lg:pt-11 max-sm:top-2 max-sm:right-2 max-sm:left-2 max-sm:pt-11 short:top-2 short:right-2 short:left-2 short:pt-11 landscape:right-[150px]! landscape:left-[88px]! landscape:pt-0!">
        <PlayerPanels />
      </div>
      <Sheet open={logOpen} onOpenChange={setLogOpen}>
        <SheetTrigger asChild>
          <Button
            size="sm"
            variant="secondary"
            className="absolute top-3 left-3 z-20 hidden bg-hud backdrop-blur-md max-lg:inline-flex max-sm:top-2 max-sm:left-2 short:top-2 short:left-2 short:inline-flex"
          >
            <ScrollText aria-hidden="true" />
            {t("session.hud.log")}
          </Button>
        </SheetTrigger>
        <SheetContent title={t("session.hud.eventLog")} side="right">
          <EventLog />
        </SheetContent>
      </Sheet>
      <aside
        ref={setAside}
        aria-label={t("session.hud.gameLog")}
        className="pointer-events-auto absolute top-14 right-3 bottom-[calc(var(--hud-bottom,180px)_+_8px)] flex w-[min(300px,28vw)] flex-col max-lg:hidden short:hidden"
      >
        {!logOpen && <EventLog />}
      </aside>
      <Hand ref={setHand} />
      <StatusPill />
      <div
        ref={setCluster}
        data-testid="fab-cluster"
        className="absolute right-3 bottom-[calc(var(--hand-h,104px)_+_12px)] flex max-sm:right-2 short:right-2"
      >
        <ActionButtons />
      </div>
      <DiceTray />
      <TurnFocus />
      <CountdownAnnouncer />
    </>
  );
}

/** DOM overlay above the canvas. The container ignores the pointer; interactive children opt in. */
export function Hud() {
  const room = useRoomStore((s) => s.room);
  const status = useRoomStore((s) => s.status);
  const hasView = useGameStore((s) => s.view !== null);
  const inGame = room !== null && status !== "lobby" && hasView;
  // Radix portals render into this element (components/ui/hud-root.ts).
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [corner, setCorner] = useState<HTMLDivElement | null>(null);
  return (
    <HudRootContext value={root}>
      <TooltipProvider delayDuration={300}>
        <div
          className="hud absolute inset-0 z-10 overflow-clip text-[13px] text-hud-fg"
          ref={setRoot}
        >
          <ConnectionBadge />
          <ReloadBanner />
          <div
            ref={setCorner}
            className={cn(
              "absolute left-3 flex gap-2 max-sm:left-2 short:left-2",
              inGame
                ? // In a game: on desktop the controls join the top bar (left of the connection
                  // badge); elsewhere they stack at the left, just above the raised hand.
                  "bottom-[calc(var(--hand-h,72px)_+_12px)] flex-col items-start desktop:top-3 desktop:right-[170px] desktop:bottom-auto desktop:left-auto desktop:flex-row desktop:items-center"
                : "bottom-[max(12px,env(safe-area-inset-bottom))] items-center max-sm:bottom-2 short:bottom-2",
            )}
          >
            <LanguageSwitch />
            <BoardStyleSwitch />
            <CreditsButton />
          </div>
          {room === null && <StartScreen />}
          {room !== null && status === "lobby" && <Lobby />}
          {inGame && <GameHud corner={corner} />}
          <div className="absolute top-24 left-1/2 flex w-[min(420px,calc(100%-32px))] -translate-x-1/2 flex-col items-center gap-1.5 max-sm:top-auto max-sm:bottom-[58%] short:top-auto short:bottom-[58%]">
            <Toasts />
            <Rejection />
          </div>
          <DiscardDialog />
          <YearOfPlentyDialog />
          <MonopolyDialog />
          <MaritimePanel />
          <VictimDialog />
          <GameOver />
          <ReplacedNotice />
        </div>
      </TooltipProvider>
    </HudRootContext>
  );
}
