// "Buy me a coffee" button (openspec change buy-me-a-coffee). The Buy Me a Coffee page refuses to
// be embedded (X-Frame-Options: SAMEORIGIN), so the button opens it directly in a new tab.
import { Coffee } from "lucide-react";
import { useTranslation } from "react-i18next";

export const SUPPORT_URL = "https://buymeacoffee.com/ayoubsaif";

const DEFAULT_CLASS =
  "mx-auto flex cursor-pointer items-center gap-2 rounded-full border border-[#c9a04e]/40 bg-[#2a160b]/75 px-4 py-2 text-sm font-semibold text-[#f6ecd0] shadow-sm shadow-black/20 outline-none backdrop-blur-sm hover:bg-[#2a160b]/90 focus-visible:ring-2 focus-visible:ring-ring";

export function SupportButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <a
      href={SUPPORT_URL}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="support-button"
      data-interactive
      className={className ?? DEFAULT_CLASS}
    >
      <Coffee aria-hidden data-icon size={18} className="text-[#f0c860]" />
      {t("session.support.button")}
    </a>
  );
}
