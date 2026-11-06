// First screen (openspec welcome-screen): the favicon as logotype, a drawn island, the Play
// button, three short steps, example cards for the building costs and a few tips. Ad slots sit
// in the left and right margins on wide screens (AdGutters). Shown once per visit before the
// start screen, unless an invite link, a notice or a returning player skips it.
import { COSTS } from "@hexfall/engine/geometry";
import type { ResourceBundle } from "@hexfall/engine";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
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

/** Own illustration: an island of hexes in the resource colours with a road, a settlement and a city. */
function IslandArt() {
  const r = 34;
  const w = r * Math.sqrt(3);
  const hexes: [number, number, string, string?][] = [
    [-0.5, -1, "var(--color-res-wool)", "9"],
    [0.5, -1, "var(--color-res-lumber)"],
    [-1, 0, "var(--color-res-ore)", "6"],
    [0, 0, "var(--color-res-grain)", "8"],
    [1, 0, "var(--color-res-brick)"],
    [-0.5, 1, "var(--color-res-lumber)"],
    [0.5, 1, "var(--color-res-wool)", "5"],
  ];
  const pts = (cx: number, cy: number) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = (Math.PI / 3) * i + Math.PI / 6;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
  const at = (q: number, row: number): [number, number] => [q * w, row * r * 1.5];
  const [sx, sy] = at(0, 0);
  const [cx, cy] = at(1, 0);
  return (
    <svg viewBox="-150 -92 300 184" className="h-auto w-full max-w-[360px]" aria-hidden="true">
      <defs>
        <radialGradient id="welcome-sea" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#7fd0d8" />
          <stop offset="100%" stopColor="#2f8fa8" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="4" rx="146" ry="86" fill="url(#welcome-sea)" opacity="0.85" />
      <ellipse
        cx="0"
        cy="4"
        rx="132"
        ry="76"
        fill="none"
        stroke="#fff"
        strokeOpacity="0.5"
        strokeWidth="2"
        strokeDasharray="6 8"
      />
      {hexes.map(([q, row, fill, token]) => {
        const [x, y] = at(q, row);
        return (
          <g key={`${q},${row}`}>
            <polygon
              points={pts(x, y)}
              fill={fill}
              stroke="var(--color-paper)"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
            {token && (
              <>
                <circle cx={x} cy={y} r="10" fill="var(--color-paper)" stroke="#876235" />
                <text
                  x={x}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize="12"
                  fontWeight="700"
                  fill={token === "6" || token === "8" ? "#8f2b21" : "#2b3f38"}
                >
                  {token}
                </text>
              </>
            )}
          </g>
        );
      })}
      {/* A road from the settlement to the city. */}
      <line
        x1={sx + 14}
        y1={sy - 14}
        x2={cx - 14}
        y2={cy - 14}
        stroke="#c0392b"
        strokeWidth="5"
        strokeLinecap="round"
      />
      {/* Settlement (house) */}
      <g transform={`translate(${sx + 14} ${sy - 18})`}>
        <path d="M-7 8V-1L0-8L7-1V8Z" fill="#e8c06a" stroke="#4a2c1a" strokeWidth="1.5" />
      </g>
      {/* City (taller, with a tower) */}
      <g transform={`translate(${cx - 14} ${cy - 18})`}>
        <path
          d="M-9 8V-2H-3V-9L2-12L7-9V-2H9V8Z"
          fill="#e8c06a"
          stroke="#4a2c1a"
          strokeWidth="1.5"
        />
      </g>
    </svg>
  );
}

const STEPS = ["s1", "s2", "s3"] as const;
const TIPS = ["t1", "t2", "t3"] as const;
const EXAMPLES: { key: "road" | "settlement" | "city" | "devCard"; cost: ResourceBundle }[] = [
  { key: "road", cost: COSTS.road },
  { key: "settlement", cost: COSTS.settlement },
  { key: "city", cost: COSTS.city },
  { key: "devCard", cost: COSTS.devCard },
];

/** Ad slots in the side margins; only on screens wide enough to keep the card clear. */
export function AdGutters() {
  const { t } = useTranslation();
  const slot =
    "pointer-events-auto absolute top-1/2 hidden h-[min(600px,70%)] w-[160px] -translate-y-1/2 flex-col items-center justify-center rounded-none border border-dashed border-gold/50 bg-black/10 text-[11px] tracking-widest text-cream/70 uppercase backdrop-blur-[2px] min-[1180px]:flex";
  return (
    <>
      <aside
        data-testid="ad-slot-left"
        data-ad-slot="left"
        aria-label={t("session.welcome.ad")}
        className={`${slot} left-3`}
      >
        {t("session.welcome.ad")}
      </aside>
      <aside
        data-testid="ad-slot-right"
        data-ad-slot="right"
        aria-label={t("session.welcome.ad")}
        className={`${slot} right-3`}
      >
        {t("session.welcome.ad")}
      </aside>
    </>
  );
}

export function Welcome({ onPlay }: { onPlay: () => void }) {
  const { t } = useTranslation();
  return (
    <div
      data-testid="welcome"
      data-interactive
      className="pointer-events-auto absolute top-1/2 left-1/2 flex max-h-[calc(100%-32px)] w-[min(700px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-3 overflow-auto frame frame-brass paper rounded-none p-6 text-center text-sm backdrop-blur-sm max-sm:p-4"
    >
      <div className="flex items-center gap-3">
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
      </div>

      <IslandArt />

      <Button
        size="default"
        className="min-h-12 px-10 text-xl"
        data-testid="welcome-play"
        onClick={onPlay}
      >
        {t("session.welcome.play")}
      </Button>

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
  );
}
