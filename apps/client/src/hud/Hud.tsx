import { useLayoutEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button.tsx";
import { HudRootContext } from "@/components/ui/hud-root.ts";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet.tsx";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { cn } from "@/lib/utils.ts";
import type { ConnectionStatus } from "../net/connection.ts";
import { useConnectionStore } from "../store/connection.ts";
import { useGameStore } from "../store/game.ts";
import { DEFAULT_DOCK, hudLayout, setDiceDock } from "../store/dock.ts";
import { useRoomStore } from "../store/room.ts";
import { type LogTab, setLogTab, useUiStore } from "../store/ui.ts";
import { SettingsButton, SettingsHost } from "../settings/SettingsButton.tsx";
import { ViewControls } from "./ViewControls.tsx";
import { GameAlerts } from "./GameAlerts.tsx";
import {
  ActionButtons,
  CountdownAnnouncer,
  DiceStats,
  DiceTray,
  DiscardDialog,
  EventLog,
  GameOver,
  Hand,
  HostGameMenu,
  Lobby,
  MaritimePanel,
  MonopolyDialog,
  OffersTray,
  PausedNotice,
  PlayerPanels,
  Rejection,
  ReplacedNotice,
  StartScreen,
  StatusPill,
  Toasts,
  TradePanel,
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

/** Small pill in the bottom control cluster. Static dot: no HUD element animates continuously. */
function ConnectionBadge() {
  const { t } = useTranslation();
  const status = useConnectionStore((s) => s.status);
  const latencyMs = useConnectionStore((s) => s.latencyMs);
  const attempts = useConnectionStore((s) => s.attempts);
  const showPing = status === "open" && latencyMs !== null;
  return (
    <div
      className="pointer-events-auto flex items-center gap-2 rounded-full paper px-3 py-1.5 text-xs backdrop-blur-sm"
      data-status={status}
      role="status"
      aria-live="polite"
    >
      <span className={cn("size-2 rounded-full", DOT[status])} aria-hidden="true" />
      <span data-testid="connection-status">{t(`session.hud.connection.${status}`)}</span>
      {showPing && (
        <span data-testid="connection-ping" className="text-muted-foreground tabular-nums max-sm:hidden">
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
      className="pointer-events-auto absolute top-14 left-1/2 z-30 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3.5 rounded-xl border border-primary paper px-4 py-2.5 text-sm backdrop-blur-md"
      role="alert"
    >
      <span>{t("session.hud.newVersion")}</span>
      <Button onClick={() => window.location.reload()}>{t("session.hud.reload")}</Button>
    </div>
  );
}

/** Layout CSS variables published on the root element by `useHudLayout`. */
const LAYOUT_VARS = ["--hand-h", "--pill-bottom", "--pill-side", "--corner-h"] as const;

/**
 * Measures the HUD and publishes (store/dock.ts `hudLayout`):
 * - `--hand-h`: the edge hand's full card height (the floating buttons and corner controls sit
 *   above it, so a raised card never covers them);
 * - `--pill-bottom` / `--pill-side`: the status pill's place above the hand;
 * - `--corner-h`: height of the corner controls when they stand above the hand (else 0), so the
 *   offers tray sits above them;
 * - the dice dock: left of the buttons, above the hand.
 * The board is a full-screen background and is not resized around any of this.
 */
function useHudLayout(corner: HTMLElement | null) {
  const [hand, setHand] = useState<HTMLDivElement | null>(null);
  const [cluster, setCluster] = useState<HTMLDivElement | null>(null);
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
      const k = corner?.getBoundingClientRect() ?? null;
      // The corner controls only stand above the hand when they sit in the lower half.
      const cornerHeight = k && k.top > height / 2 ? k.height : 0;
      root.style.setProperty("--corner-h", `${Math.ceil(cornerHeight)}px`);
      const layout = hudLayout({
        width,
        height,
        handHeight,
        cluster: { left: c.left, top: c.top },
        cornerHeight,
      });
      root.style.setProperty("--pill-bottom", `${layout.pillBottom}px`);
      root.style.setProperty("--pill-side", `${layout.pillSide}px`);
      setDiceDock(layout.dock);
    };
    update();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    for (const el of [hand, cluster, corner]) if (el) observer?.observe(el);
    window.addEventListener("resize", update);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", update);
      for (const v of LAYOUT_VARS) root.style.removeProperty(v);
      setDiceDock(DEFAULT_DOCK);
    };
  }, [hand, cluster, corner]);
  return { setHand, setCluster };
}

/** The "Log" button (top-left) and its drawer (Log and Dice tabs). */
function LogDrawer() {
  const { t } = useTranslation();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          size="sm"
          variant="secondary"
          className="absolute top-3 left-3 z-20 paper backdrop-blur-md max-sm:top-2 max-sm:left-2 short:top-2 short:left-2"
        >
          <ScrollText aria-hidden="true" />
          {t("session.hud.log")}
        </Button>
      </SheetTrigger>
      <SheetContent title={t("session.hud.eventLog")} side="right">
        <LogTabs />
      </SheetContent>
    </Sheet>
  );
}

/**
 * In-game HUD (specs/hud-presentation "Responsive HUD layout"; design decisions 6, 7 and 9):
 * - the hand peeks from the bottom edge at the center, with no panel;
 * - the floating action buttons sit at the bottom-right, above the raised hand;
 * - the status pill floats above the hand;
 * - the event log opens as a drawer from the "Log" button at the top-left, with Log and Dice
 *   tabs (game-hud "Log drawer tabs"); every other control sits in the bottom-left cluster;
 * - tablet, mobile and short screens get compact panels.
 */
function GameHud({ corner }: { corner: HTMLElement | null }) {
  const { setHand, setCluster } = useHudLayout(corner);
  return (
    <>
      <LogDrawer />
      <div className="absolute top-3 right-3 left-3 pt-11 desktop:right-[400px] max-sm:top-2 max-sm:right-2 max-sm:left-2 short:top-2 short:right-2 short:left-2 landscape:right-3! landscape:left-[88px]! landscape:pt-0!">
        <PlayerPanels />
      </div>
      <Hand ref={setHand} />
      <StatusPill />
      <div
        data-testid="offers-anchor"
        className="absolute bottom-[calc(var(--hand-h,104px)_+_var(--corner-h,0px)_+_20px)] left-3 flex w-[min(300px,calc(100%-96px))] flex-col max-sm:left-2 short:left-2"
      >
        <OffersTray />
      </div>
      <div
        ref={setCluster}
        data-testid="fab-cluster"
        className="absolute right-3 bottom-[calc(var(--hand-h,104px)_+_12px)] flex max-sm:right-2 short:right-2"
      >
        <ActionButtons />
      </div>
      <DiceTray />
      <TurnFocus />
      <GameAlerts />
      <CountdownAnnouncer />
    </>
  );
}

/** The log drawer's body: Log and Dice tabs; it reopens on the tab last selected. */
function LogTabs() {
  const { t } = useTranslation();
  const tab = useUiStore((s) => s.logTab);
  return (
    <Tabs value={tab} onValueChange={(v) => setLogTab(v as LogTab)} className="flex-1">
      <TabsList>
        <TabsTrigger value="log">{t("dialogs.feed.tabLog")}</TabsTrigger>
        <TabsTrigger value="dice">{t("dialogs.feed.tabDice")}</TabsTrigger>
      </TabsList>
      <TabsContent value="log">
        <EventLog />
      </TabsContent>
      <TabsContent value="dice">
        <DiceStats />
      </TabsContent>
    </Tabs>
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
          <ReloadBanner />
          <div
            ref={setCorner}
            className={cn(
              "absolute left-3 flex gap-2 max-sm:left-2 short:left-2",
              inGame
                ? // In a game the controls (all but Log) sit in the bottom-left corner beside the
                  // hand; portrait phones stack them in a column above the raised hand.
                  "bottom-[max(12px,env(safe-area-inset-bottom))] max-w-[calc(100%-200px)] flex-wrap items-center max-sm:bottom-[calc(var(--hand-h,72px)_+_12px)] max-sm:flex-col max-sm:items-start portrait:bottom-[calc(var(--hand-h,72px)_+_12px)] portrait:flex-col portrait:items-start desktop:bottom-[max(12px,env(safe-area-inset-bottom))] desktop:flex-row desktop:items-center"
                : "bottom-[max(12px,env(safe-area-inset-bottom))] flex-wrap items-center max-sm:bottom-2 short:bottom-2",
            )}
          >
            <SettingsButton />
            {inGame && <ViewControls />}
            {inGame && <HostGameMenu />}
            <ConnectionBadge />
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
          <TradePanel />
          <VictimDialog />
          {inGame && <PausedNotice />}
          <GameOver />
          <ReplacedNotice />
          <SettingsHost />
        </div>
      </TooltipProvider>
    </HudRootContext>
  );
}
