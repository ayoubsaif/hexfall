// Settings dialog (specs/client-settings "Settings dialog layout"), built from the shadcn
// `sidebar-13` block: section sidebar on md+ screens, a native section picker below md, and a
// "Settings › <section>" breadcrumb. Settings apply at once; there is no Save button.
import { Accessibility, Bell, Globe, Info, Keyboard, type LucideIcon, Volume2 } from "lucide-react";
import { type CSSProperties, type ReactNode, useId } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb.tsx";
import { SealIcon } from "@/components/ui/SealIcon.tsx";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog.tsx";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar.tsx";
import {
  SECTION_IDS,
  type SectionId,
  isSectionId,
  setSettingsOpen,
  setSettingsSection,
  settingsTrigger,
  useSettingsStore,
} from "./sections.ts";
import { AboutSection } from "./sections/AboutSection.tsx";
import { AccessibilitySection } from "./sections/AccessibilitySection.tsx";
import { KeyboardSection } from "./sections/KeyboardSection.tsx";
import { LanguageSection } from "./sections/LanguageSection.tsx";
import { NotificationsSection } from "./sections/NotificationsSection.tsx";
import { SoundSection } from "./sections/SoundSection.tsx";

const ICONS: Record<SectionId, LucideIcon> = {
  language: Globe,
  sound: Volume2,
  notifications: Bell,
  accessibility: Accessibility,
  keyboard: Keyboard,
  about: Info,
};

const CONTENT: Record<SectionId, () => ReactNode> = {
  language: () => <LanguageSection />,
  sound: () => <SoundSection />,
  notifications: () => <NotificationsSection />,
  accessibility: () => <AccessibilitySection />,
  keyboard: () => <KeyboardSection />,
  about: () => <AboutSection />,
};

export function SettingsDialog() {
  const { t } = useTranslation();
  const id = useId();
  const open = useSettingsStore((s) => s.open);
  const section = useSettingsStore((s) => s.section);
  const name = (s: SectionId) => t(`settings.section.${s}`);
  return (
    <Dialog open={open} onOpenChange={setSettingsOpen}>
      <DialogContent
        title={t("settings.title")}
        description={t("settings.description")}
        hideHeader
        data-testid="settings-dialog"
        className="flex h-[min(560px,calc(100dvh-32px))] w-[min(800px,calc(100%-32px))] overflow-hidden p-0 [--corner-size:32px]"
        onCloseAutoFocus={(e) => {
          const el = settingsTrigger();
          if (!el?.isConnected) return;
          e.preventDefault();
          el.focus();
        }}
      >
        <SidebarProvider
          className="min-h-0 items-stretch"
          style={{ "--sidebar-width": "13rem" } as CSSProperties}
        >
          <Sidebar
            collapsible="none"
            className="hidden border-r border-sidebar-border bg-ink/10 md:flex"
          >
            <SidebarContent className="pt-6">
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {SECTION_IDS.map((s) => {
                      const Icon = ICONS[s];
                      return (
                        <SidebarMenuItem key={s}>
                          <SidebarMenuButton
                            isActive={s === section}
                            aria-current={s === section ? "page" : undefined}
                            data-testid={`settings-nav-${s}`}
                            onClick={() => setSettingsSection(s)}
                          >
                            <Icon aria-hidden />
                            <span>{name(s)}</span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>
          <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <header className="flex h-14 shrink-0 items-center gap-2 pr-12 pl-4">
              <Breadcrumb className="hidden md:block" data-testid="settings-breadcrumb">
                <BreadcrumbList>
                  <BreadcrumbItem>{t("settings.title")}</BreadcrumbItem>
                  <BreadcrumbSeparator />
                  <BreadcrumbItem>
                    <BreadcrumbPage>{name(section)}</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex min-w-0 flex-1 items-center gap-2 md:hidden">
                <label htmlFor={`${id}-section`} className="sr-only">
                  {t("settings.sectionPicker")}
                </label>
                <select
                  id={`${id}-section`}
                  data-testid="settings-picker"
                  value={section}
                  className="min-h-10 w-full min-w-0 cursor-pointer rounded-none border border-border bg-ink/10 px-2 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onChange={(e) => {
                    if (isSectionId(e.target.value)) setSettingsSection(e.target.value);
                  }}
                >
                  {SECTION_IDS.map((s) => (
                    <option key={s} value={s} className="bg-hud-solid">
                      {name(s)}
                    </option>
                  ))}
                </select>
              </div>
            </header>
            <section
              aria-label={name(section)}
              data-testid={`settings-section-${section}`}
              className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
            >
              {CONTENT[section]()}
            </section>
          </main>
        </SidebarProvider>
        <DialogClose
          aria-label={t("settings.close")}
          data-testid="settings-close"
          className="absolute top-2 right-2 z-10 grid size-11 cursor-pointer place-items-center outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring max-sm:size-12"
        >
          <SealIcon className="size-full drop-shadow-md" />
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}

export default SettingsDialog;
