// Shown when another tab took this seat (specs/client-session, "Replaced connection").
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { playHere } from "../net/actions.ts";
import { useConnectionStore } from "../store/connection.ts";

/** Always mounted; renders only while the connection status is "replaced". */
export function ReplacedNotice() {
  const { t } = useTranslation();
  const replaced = useConnectionStore((s) => s.status === "replaced");
  if (!replaced) return null;
  return (
    <div
      role="alert"
      data-interactive
      className="pointer-events-auto absolute top-14 left-1/2 flex max-w-[calc(100%-32px)] -translate-x-1/2 items-center gap-3.5 rounded-xl border border-accent paper px-4 py-2.5 text-sm backdrop-blur-sm max-sm:flex-wrap"
    >
      <span>{t("session.replaced.text")}</span>
      <Button variant="secondary" onClick={() => playHere()}>
        {t("session.replaced.playHere")}
      </Button>
    </div>
  );
}
