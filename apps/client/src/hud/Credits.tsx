// Credits view (specs/asset-theming, "Credits are visible in the client"): lists the
// active theme's per-asset credits, or its license/source when it declares none.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button.tsx";
import { Dialog, DialogClose, DialogContent, DialogFooter } from "@/components/ui/dialog.tsx";
import { useTheme } from "../theme/index.ts";
import type { ResolvedTheme } from "../theme/resolve.ts";

/** Open credits dialog for a resolved theme; exported for tests. Escape and Close call onClose. */
export function CreditsDialog({ theme, onClose }: { theme: ResolvedTheme; onClose: () => void }) {
  const { t } = useTranslation();
  const credits = theme.credits ?? [];
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent title={t("session.credits.title")}>
        {credits.length > 0 && (
          <ul data-testid="credits-list" className="my-2 pl-[18px] leading-normal">
            {credits.map((c) => (
              <li key={`${c.title}|${c.keys.join(",")}`} className="list-disc">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  {c.title}
                </a>{" "}
                {t("session.credits.by")} {c.author},{" "}
                <span className="whitespace-nowrap tabular-nums">{c.license}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="my-1 text-muted-foreground">
          {credits.length > 0 ? t("session.credits.otherAssets") : t("session.credits.themeAssets")}
          {theme.license ? (
            <>
              <span className="whitespace-nowrap tabular-nums">{theme.license}</span>
              {theme.source ? `. ${theme.source}` : ""}
            </>
          ) : (
            t("session.credits.procedural")
          )}
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button>{t("session.credits.close")}</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Small "Credits" button that opens the dialog; available on every screen. */
export function CreditsButton() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        data-testid="credits-toggle"
        aria-haspopup="dialog"
        data-interactive
        className="min-h-9 rounded-full bg-hud px-3 font-normal shadow-lg shadow-black/25 backdrop-blur-md"
        onClick={() => setOpen(true)}
      >
        {t("session.credits.title")}
      </Button>
      {open && <CreditsDialog theme={theme} onClose={() => setOpen(false)} />}
    </>
  );
}
