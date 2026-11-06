// Settings dialog (specs/client-settings "Settings dialog layout"), built from the shadcn
// `sidebar-13` block: section sidebar on md+ screens, a sidebar-style section list below md that
// drills into a section (with a back button), and a "Settings › <section>" breadcrumb. Settings apply at once; there is no Save button.
import {
  Accessibility,
  Monitor,
  Bell,
  Globe,
  ChevronLeft,
  ChevronRight,
  Info,
  Keyboard,
  type LucideIcon,
  Volume2,
} from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb.tsx";
import { cn } from "@/lib/utils.ts";
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
  setSettingsOpen,
  setSettingsSection,
  settingsTrigger,
  showSettingsList,
  useSettingsStore,
} from "./sections.ts";
import { AboutSection } from "./sections/AboutSection.tsx";
import { AccessibilitySection } from "./sections/AccessibilitySection.tsx";
import { KeyboardSection } from "./sections/KeyboardSection.tsx";
import { LanguageSection } from "./sections/LanguageSection.tsx";
import { NotificationsSection } from "./sections/NotificationsSection.tsx";
import { SoundSection } from "./sections/SoundSection.tsx";

import { GraphicsSection } from "./sections/GraphicsSection.tsx";

const ICONS: Record<SectionId, LucideIcon> = {
  graphics: Monitor,
  language: Globe,
  sound: Volume2,
  notifications: Bell,
  accessibility: Accessibility,
  keyboard: Keyboard,
  about: Info,
};

const CONTENT: Record<SectionId, () => ReactNode> = {
  graphics: () => <GraphicsSection />,
  language: () => <LanguageSection />,
  sound: () => <SoundSection />,
  notifications: () => <NotificationsSection />,
  accessibility: () => <AccessibilitySection />,
  keyboard: () => <KeyboardSection />,
  about: () => <AboutSection />,
};

export function SettingsDialog() {
  const { t } = useTranslation();
  const open = useSettingsStore((s) => s.open);
  const section = useSettingsStore((s) => s.section);
  const list = useSettingsStore((s) => s.list);
  const name = (s: SectionId) => t(`settings.section.${s}`);
  return (
    <Dialog open={open} onOpenChange={setSettingsOpen}>
      <DialogContent
        title={t("settings.title")}
        description={t("settings.description")}
        hideHeader
        data-testid="settings-dialog"
        className="flex h-[min(560px,calc(100dvh-32px))] w-[min(800px,calc(100%-32px))] overflow-hidden p-0 [--corner-size:32px] frame-corners"
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
              <div className="flex min-w-0 flex-1 items-center gap-1 md:hidden">
                {list ? (
                  <h2 className="px-1 font-serif text-lg font-semibold">{t("settings.title")}</h2>
                ) : (
                  <button
                    type="button"
                    data-testid="settings-back"
                    aria-label={t("settings.back")}
                    onClick={showSettingsList}
                    className="flex min-h-11 min-w-0 cursor-pointer items-center gap-1 pr-2 text-left font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronLeft aria-hidden className="size-5 shrink-0" />
                    <span className="truncate">{name(section)}</span>
                  </button>
                )}
              </div>
            </header>
            {list && (
              <nav
                aria-label={t("settings.sectionPicker")}
                data-testid="settings-menu"
                className="min-h-0 flex-1 overflow-y-auto px-2 pb-4 md:hidden"
              >
                <SidebarMenu>
                  {SECTION_IDS.map((s) => {
                    const Icon = ICONS[s];
                    return (
                      <SidebarMenuItem key={s}>
                        <SidebarMenuButton
                          size="lg"
                          data-testid={`settings-menu-${s}`}
                          onClick={() => setSettingsSection(s)}
                          className="min-h-12 text-base"
                        >
                          <Icon aria-hidden />
                          <span className="flex-1">{name(s)}</span>
                          <ChevronRight aria-hidden className="size-4 opacity-60" />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </nav>
            )}
            <section
              aria-label={name(section)}
              data-testid={`settings-section-${section}`}
              className={cn("min-h-0 flex-1 overflow-y-auto px-4 pb-4", list && "max-md:hidden")}
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
