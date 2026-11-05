// Settings entry point (specs/client-settings "Settings entry point"): one gear button in the
// HUD corner, and the dialog host mounted once in the HUD. The dialog code loads on first open.
import { Settings } from "lucide-react";
import { Suspense, lazy, useState } from "react";
import { useTranslation } from "react-i18next";
import { openSettings, registerSettingsTrigger, useSettingsStore } from "./sections.ts";

const SettingsDialog = lazy(() => import("./SettingsDialog.tsx"));

export function SettingsButton() {
  const { t } = useTranslation();
  const open = useSettingsStore((s) => s.open);
  const label = t("settings.open");
  return (
    <button
      ref={registerSettingsTrigger}
      type="button"
      data-testid="settings-button"
      data-interactive
      aria-label={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={label}
      className="pointer-events-auto grid size-[42px] cursor-pointer place-items-center rounded-full bg-hud text-hud-fg shadow-lg shadow-black/25 backdrop-blur-md transition-colors duration-150 outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-ring max-sm:size-[46px] short:size-[46px] motion-reduce:transition-none"
      onClick={openSettings}
    >
      <Settings aria-hidden size={18} />
    </button>
  );
}

/** Renders the dialog once it has been opened (then keeps it mounted for instant reopen). */
export function SettingsHost() {
  const open = useSettingsStore((s) => s.open);
  const [loaded, setLoaded] = useState(open);
  if (open && !loaded) setLoaded(true);
  if (!loaded) return null;
  return (
    <Suspense fallback={null}>
      <SettingsDialog />
    </Suspense>
  );
}
