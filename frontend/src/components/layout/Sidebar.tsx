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
  { label: "Overview", href: "/", icon: LayoutDashboard },
  { label: "Agent insights", href: "/ai/insights", icon: Lightbulb },
  { label: "Policies & tools", href: "/ai/policies", icon: Workflow },
  { label: "Run logs", href: "/logs", icon: List },
  { label: "Team & clients", href: "/admin/users", icon: Users },
  { label: "Human approvals", href: "/admin/approvals", icon: ClipboardCheck },
  { label: "Workspace settings", href: "/settings", icon: Settings },
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
              "group relative flex items-center gap-3 overflow-hidden rounded-xl px-4 py-3 font-medium transition-all duration-300",
              isActive
                ? "bg-sidebar-accent text-sidebar-primary font-semibold"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              isCollapsed ? "justify-center" : "justify-start"
            )}
            title={isCollapsed ? item.label : undefined}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {!isCollapsed && <span>{item.label}</span>}
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
          "z-20 hidden h-screen flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground backdrop-blur-xl transition-all duration-300 md:flex",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <div
          className={cn(
            "flex h-[4.25rem] flex-col justify-center gap-1 px-4 pb-1",
            isCollapsed ? "items-center" : ""
          )}
        >
          {!isCollapsed && (
            <div>
              <span className="text-xl font-bold tracking-tighter text-sidebar-primary">
                Luminous
              </span>
              <p className="mt-1 text-[10px] font-medium tracking-widest text-muted-foreground uppercase">
                Enterprise SaaS
              </p>
            </div>
          )}
          {isCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-accent border border-sidebar-primary/20 font-bold text-sidebar-primary">
              L
            </div>
          )}
        </div>

        <div className="hide-scrollbar flex-1 overflow-y-auto">
          <NavLinks isCollapsed={isCollapsed} />
        </div>

        <div className="mt-auto flex justify-center border-t border-sidebar-border p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapse}
            className="text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
          className="w-72 border-r-sidebar-border bg-sidebar p-0 text-sidebar-foreground backdrop-blur-xl"
        >
          <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
            <SheetTitle className="text-xl font-bold tracking-tighter text-sidebar-primary">
              Luminous
            </SheetTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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
