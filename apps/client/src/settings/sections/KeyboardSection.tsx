// Keyboard section (specs/keyboard-shortcuts "Shortcuts list in Settings"): every shortcut from
// the registry, grouped, with its keycaps.
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Kbd } from "@/components/ui/kbd.tsx";
import { GROUPS, HOTKEYS, keyLabel } from "../../hotkeys/registry.ts";

export function KeyboardSection() {
  const { t } = useTranslation();
  return (
    <div className="py-3 text-sm" data-testid="settings-keyboard">
      <p className="text-muted-foreground">{t("settings.keyboard.hint")}</p>
      {GROUPS.map((g) => (
        <section key={g} className="mt-4" aria-labelledby={`kbd-${g}`}>
          <h3 id={`kbd-${g}`} className="font-semibold">
            {t(`settings.keyboard.group.${g}`)}
          </h3>
          <ul className="mt-1 divide-y divide-border/50">
            {HOTKEYS.filter((h) => h.group === g).map((h) => (
              <li
                key={h.id}
                data-hotkey-row={h.id}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <span>{t(`settings.keyboard.action.${h.id}`)}</span>
                <span className="flex shrink-0 items-center gap-1">
                  {h.keys.map((k, i) => (
                    <Fragment key={k}>
                      {i > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {t("settings.keyboard.or")}
                        </span>
                      )}
                      <Kbd>{keyLabel(k)}</Kbd>
                    </Fragment>
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
