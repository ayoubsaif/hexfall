import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { gameIcon } from "./GameIcon.tsx";

export type GameMode = "host" | "solo" | "join";
const MODES = [
  { mode: "host", Icon: gameIcon("trade") },
  { mode: "solo", Icon: gameIcon("knight") },
  { mode: "join", Icon: gameIcon("flag") },
] as const;

export function GameModeButtons({ onSelect }: { onSelect: (mode: GameMode) => void }) {
  const { t } = useTranslation();
  return (
    <nav className="game-mode-menu" aria-label={t("session.modes.title")}>
      {MODES.map(({ mode, Icon }) => (
        <Button
          key={mode}
          variant="menu"
          data-testid={`welcome-${mode}`}
          aria-label={t(`session.modes.${mode}.title`)}
          aria-describedby={`mode-${mode}-hint`}
          onClick={() => onSelect(mode)}
        >
          <Icon className="game-mode-icon" aria-hidden />
          <span className="game-mode-copy">
            <span className="game-mode-title">{t(`session.modes.${mode}.title`)}</span>
            <span className="game-mode-hint" id={`mode-${mode}-hint`}>
              {t(`session.modes.${mode}.description`)}
            </span>
          </span>
          <span aria-hidden className="game-mode-arrow">
            ›
          </span>
        </Button>
      ))}
    </nav>
  );
}
