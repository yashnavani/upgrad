"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  LayoutDashboard,
  Lightbulb,
  List,
  Settings,
  Users,
  Workflow,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { useSidebar } from "./SidebarProvider";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "AI Insights", href: "/ai/insights", icon: Lightbulb },
  { label: "Rules & Policies", href: "/ai/policies", icon: Workflow },
  { label: "Audit Logs", href: "/logs", icon: List },
  { label: "Users & Access", href: "/admin/users", icon: Users },
  { label: "Pending Approvals", href: "/admin/approvals", icon: ClipboardCheck },
  { label: "Settings", href: "/settings", icon: Settings },
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
    <nav className="mt-6 flex flex-col gap-1.5 px-3">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname === item.href ||
              pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClick}
            className={cn(
              "group relative flex items-center gap-3 overflow-hidden rounded-lg px-3 py-2.5 transition-all duration-300",
              isActive
                ? "text-zinc-100"
                : "text-zinc-400 hover:text-zinc-100",
              isCollapsed ? "justify-center" : "justify-start"
            )}
            title={isCollapsed ? item.label : undefined}
          >
            {isActive && (
              <div
                className="absolute inset-0 z-0 border-l-2 border-primary bg-primary/10"
                aria-hidden
              />
            )}
            {!isActive && (
              <div
                className="absolute inset-0 z-0 bg-zinc-800/0 transition-colors group-hover:bg-zinc-800/50"
                aria-hidden
              />
            )}
            <item.icon
              className={cn(
                "relative z-10 h-5 w-5 shrink-0 transition-transform duration-300",
                isActive ? "text-primary" : "group-hover:scale-110"
              )}
            />
            {!isCollapsed && (
              <span
                className={cn(
                  "relative z-10 text-sm font-medium",
                  isActive && "font-semibold text-zinc-100"
                )}
              >
                {item.label}
              </span>
            )}
          </Link>
        );
      })}
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
          "z-20 hidden h-screen flex-col border-r border-zinc-900 bg-zinc-950 text-zinc-50 transition-all duration-300 md:flex",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-16 items-center px-4",
            isCollapsed ? "justify-center" : "justify-between"
          )}
        >
          {!isCollapsed && (
            <span className="text-lg font-bold tracking-tight">
              Master<span className="text-primary">Foundation</span>
            </span>
          )}
          {isCollapsed && (
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary font-bold">
              M
            </div>
          )}
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto">
          <NavLinks isCollapsed={isCollapsed} />
        </div>

        <div className="flex justify-center border-t border-zinc-900 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
          >
            {isCollapsed ? (
              <ChevronRight className="h-5 w-5" />
            ) : (
              <ChevronLeft className="h-5 w-5" />
            )}
          </Button>
        </div>
      </aside>

      <Sheet open={isMobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          showCloseButton={false}
          className="w-72 border-r-zinc-900 bg-zinc-950 p-0 text-zinc-50"
        >
          <div className="flex h-16 items-center justify-between border-b border-zinc-900 px-6">
            <SheetTitle className="text-lg font-bold text-zinc-50">
              Master<span className="text-primary">Foundation</span>
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="text-zinc-400 hover:bg-zinc-800 hover:text-zinc-50"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="px-4">
            <NavLinks
              isCollapsed={false}
              onClick={() => setMobileOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
