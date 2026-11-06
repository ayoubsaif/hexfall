// Board view controls (specs/board-view "View presets", specs/camera-gestures "Zoom controls"):
// a translucent bar with zoom out, a zoom slider, zoom in, the zoom percent and the three view
// presets (default, top-down centered, diagonal). Every button sits
// in one thin translucent rounded card; gold line icons (orbit = free, map = top-down, cube = diagonal).
import { Box, Map as MapIcon, Minus, Orbit, Plus, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import { hotkeyLabel } from "../hotkeys/registry.ts";
import {
  type ViewPreset,
  ZOOM_MAX,
  ZOOM_MIN,
  requestZoom,
  setViewPreset,
  useViewStore,
} from "../store/view.ts";

const VIEWS: {
  preset: ViewPreset;
  icon: LucideIcon;
  key: "board.viewFree" | "board.viewTop" | "board.viewDiagonal";
}[] = [
  { preset: "free", icon: Orbit, key: "board.viewFree" },
  { preset: "top", icon: MapIcon, key: "board.viewTop" },
  { preset: "diagonal", icon: Box, key: "board.viewDiagonal" },
];

const STEP = 15;
const BTN =
  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-[#f0c860] outline-none transition-colors duration-150 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40 max-sm:size-10 short:size-10 pointer-coarse:size-11 motion-reduce:transition-none";

export function ViewControls() {
  const { t } = useTranslation();
  const current = useViewStore((s) => s.preset);
  const zoom = useViewStore((s) => s.zoom);
  return (
    <div
      role="group"
      aria-label={t("board.viewGroup")}
      data-testid="view-controls"
      className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/35 px-1.5 py-0.5 text-[#f6ecd0] shadow-sm shadow-black/20 backdrop-blur-sm"
    >
      <button
        type="button"
        data-interactive
        data-testid="zoom-out"
        aria-label={t("board.zoomOut")}
        title={`${t("board.zoomOut")} (${hotkeyLabel("zoomOut")})`}
        aria-keyshortcuts="-"
        disabled={zoom <= ZOOM_MIN}
        onClick={() => requestZoom(zoom - STEP)}
        className={BTN}
      >
        <Minus aria-hidden size={18} strokeWidth={2.5} />
      </button>
      <input
        type="range"
        data-interactive
        data-testid="zoom-slider"
        className="hud-range w-24 max-sm:hidden short:hidden"
        aria-label={t("board.zoomSlider")}
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={1}
        value={zoom}
        onChange={(e) => requestZoom(Number(e.currentTarget.value))}
      />
      <button
        type="button"
        data-interactive
        data-testid="zoom-in"
        aria-label={t("board.zoomIn")}
        title={`${t("board.zoomIn")} (${hotkeyLabel("zoomIn")})`}
        aria-keyshortcuts="+"
        disabled={zoom >= ZOOM_MAX}
        onClick={() => requestZoom(zoom + STEP)}
        className={BTN}
      >
        <Plus aria-hidden size={18} strokeWidth={2.5} />
      </button>
      <span
        data-testid="zoom-value"
        className="min-w-[3.4ch] text-center text-sm font-semibold tabular-nums [text-shadow:0_1px_2px_rgb(0_0_0/70%)]"
      >
        {zoom}%
      </span>
      <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-[#c9a04e]/40" />
      {VIEWS.map(({ preset, icon: Icon, key }) => (
        <button
          key={preset}
          type="button"
          data-interactive
          data-testid={`view-${preset}`}
          aria-label={t(key)}
          title={t(key)}
          aria-pressed={current === preset}
          onClick={() => setViewPreset(preset)}
          className={cn(
            BTN,
            "aria-pressed:bg-black/40 aria-pressed:ring-1 aria-pressed:ring-[#e8bc4a]/70",
          )}
        >
          <Icon aria-hidden size={20} strokeWidth={2} />
        </button>
      ))}
    </div>
  );
}
