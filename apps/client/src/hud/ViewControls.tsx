// Board view controls (specs/board-view "View presets", specs/camera-gestures "Zoom controls"):
// a translucent bar with zoom out, a zoom slider, zoom in, the zoom percent and the three view
// presets (default, top-down centered, diagonal).
import { Minus, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils.ts";
import {
  type ViewPreset,
  ZOOM_MAX,
  ZOOM_MIN,
  requestZoom,
  setViewPreset,
  useViewStore,
} from "../store/view.ts";
import { gameIcon } from "./GameIcon.tsx";

const VIEWS: {
  preset: ViewPreset;
  icon: ReturnType<typeof gameIcon>;
  key: "board.viewFree" | "board.viewTop" | "board.viewDiagonal";
}[] = [
  { preset: "free", icon: gameIcon("view-free"), key: "board.viewFree" },
  { preset: "top", icon: gameIcon("view-top"), key: "board.viewTop" },
  { preset: "diagonal", icon: gameIcon("view-diagonal"), key: "board.viewDiagonal" },
];

const STEP = 15;
const BTN =
  "grid size-9 shrink-0 cursor-pointer place-items-center rounded-md text-[#f0c860] outline-none transition-colors duration-150 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default disabled:opacity-40 max-sm:size-10 pointer-coarse:size-11 motion-reduce:transition-none";

export function ViewControls() {
  const { t } = useTranslation();
  const current = useViewStore((s) => s.preset);
  const zoom = useViewStore((s) => s.zoom);
  return (
    <div
      role="group"
      aria-label={t("board.viewGroup")}
      data-testid="view-controls"
      className="pointer-events-auto flex items-center gap-1.5 rounded-lg border border-[#c9a04e]/45 bg-[#0d3640]/70 px-2 py-1 text-[#f6ecd0] shadow-md shadow-black/30 backdrop-blur-sm"
    >
      <button
        type="button"
        data-interactive
        data-testid="zoom-out"
        aria-label={t("board.zoomOut")}
        title={t("board.zoomOut")}
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
        className="hud-range w-24 max-sm:hidden"
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
        title={t("board.zoomIn")}
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
      <span aria-hidden="true" className="mx-0.5 h-6 w-px bg-[#c9a04e]/40" />
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
          <Icon aria-hidden className="size-6" />
        </button>
      ))}
    </div>
  );
}
