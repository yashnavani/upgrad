"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Headphones,
  LayoutDashboard,
  Lightbulb,
  List,
  Mic,
  Settings,
  Workflow,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { useSidebar } from "./SidebarProvider";

interface NavSection {
  title: string;
  items: { label: string; href: string; icon: React.ComponentType<{ className?: string }> }[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { label: "Dashboard", href: "/", icon: LayoutDashboard },
    ],
  },
  {
    title: "Operations",
    items: [
      { label: "Mock interview", href: "/interview", icon: Mic },
      { label: "Voice interview", href: "/interview/voice", icon: Headphones },
      { label: "Agent Insights", href: "/ai/insights", icon: Lightbulb },
      { label: "Policies & Tools", href: "/ai/policies", icon: Workflow },
      { label: "Run Logs", href: "/logs", icon: List },
    ],
  },
  {
    title: "Configuration",
    items: [
      { label: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

function NavLinks({
  isCollapsed,
  onClick,
}: {
  isCollapsed: boolean;
  onClick?: () => void;
}) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-4 px-2 pt-4">
      {NAV_SECTIONS.map((section) => (
        <div key={section.title}>
          {!isCollapsed && (
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
              {section.title}
            </p>
          )}
          <div className="flex flex-col gap-0.5">
            {section.items.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href ||
                    (item.href === "/interview"
                      ? pathname.startsWith("/interview") &&
                        !pathname.startsWith("/interview/voice")
                      : pathname.startsWith(`${item.href}/`) || pathname === item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClick}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                    isActive
                      ? "bg-sidebar-accent text-white"
                      : "text-sidebar-foreground hover:bg-white/5 hover:text-white",
                    isCollapsed ? "justify-center" : "justify-start"
                  )}
                  title={isCollapsed ? item.label : undefined}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  {!isCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}

export function Sidebar() {
  const { isCollapsed, isMobileOpen, setMobileOpen, toggleCollapse } =
    useSidebar();

  return (
    <>
      <aside
        className={cn(
          "z-20 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-all duration-200 md:flex",
          isCollapsed ? "w-[68px]" : "w-[240px]"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center gap-3 border-b border-sidebar-border px-4",
            isCollapsed ? "justify-center" : ""
          )}
        >
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-tight">Luminous</p>
                <p className="text-[10px] font-medium text-sidebar-foreground/60">Powered by AI</p>
              </div>
            </div>
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5" />
                <path d="M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto">
          <NavLinks isCollapsed={isCollapsed} />
        </div>

        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={toggleCollapse}
            className="flex w-full items-center justify-center rounded-lg p-2 text-sidebar-foreground/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-[240px] border-r-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
            <SheetTitle className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <svg className="h-4 w-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="text-sm font-bold text-white">Luminous</span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="text-sidebar-foreground hover:bg-white/5 hover:text-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <NavLinks
            isCollapsed={false}
            onClick={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
