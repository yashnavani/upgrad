"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { BrainCircuit, Command, Menu, Search } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useUI } from "@/components/providers/UIProvider";
import { NotificationCenter } from "@/components/ui-patterns/NotificationCenter";
import { apiClient } from "@/lib/api-client";
import type { MeDto } from "@/lib/dashboard-types";

import { useSidebar } from "./SidebarProvider";

function titleCaseSegment(segment: string) {
  return segment
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function Header() {
  const { setMobileOpen } = useSidebar();
  const { setCommandOpen, setAIOpen } = useUI();
  const pathname = usePathname();
  const [me, setMe] = useState<MeDto | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const profile = await apiClient<MeDto>("/users/me");
        if (!cancelled) setMe(profile);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pathSegment =
    pathname === "/" ? "Dashboard" : pathname.split("/").filter(Boolean).pop();
  const pageTitle = pathSegment ? titleCaseSegment(pathSegment) : "";

  const email = me?.email ?? "—";
  const displayName = me?.full_name?.trim() || email;
  const initial = (email[0] ?? "U").toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="font-heading text-sm font-semibold text-foreground">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => setCommandOpen(true)}
          className="hidden h-8 w-48 items-center justify-start gap-2 border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 lg:w-56 lg:flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left text-xs font-normal">
            Search...
          </span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </Button>

        <Button
          variant="default"
          onClick={() => setAIOpen(true)}
          className="hidden items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 lg:flex"
        >
          <BrainCircuit className="h-4 w-4" />
          <span>Agent</span>
        </Button>

        <NotificationCenter />

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-1 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar className="h-6 w-6">
              <AvatarImage src={undefined} alt={email} />
              <AvatarFallback className="bg-primary text-[10px] font-semibold text-white">
                {initial}
              </AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{displayName}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{displayName}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>Profile</DropdownMenuItem>
            <DropdownMenuItem disabled>Settings</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
