"use client";

import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
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
import { useUI } from "@/components/providers/UIProvider";
import { NotificationCenter } from "@/components/ui-patterns/NotificationCenter";

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
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    await signOut({ callbackUrl: "/login" });
  };

  const pathSegment =
    pathname === "/" ? "Dashboard" : pathname.split("/").filter(Boolean).pop();
  const pageTitle = pathSegment ? titleCaseSegment(pathSegment) : "";

  const email = session?.user?.email ?? "Loading...";
  const displayName = email === "Loading..." ? "Authorized User" : email;
  const initial = (email[0] ?? "U").toUpperCase();

  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-border/40 bg-white/50 px-4 backdrop-blur-md sm:px-6 dark:bg-zinc-950/50">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground md:hidden"
          onClick={() => setMobileOpen(true)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-sm font-semibold tracking-tight text-foreground">
          {pageTitle}
        </h1>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          onClick={() => setCommandOpen(true)}
          className="hidden w-64 items-center justify-start gap-2 border-border/50 bg-muted/20 text-muted-foreground transition-colors hover:border-primary/50 sm:flex"
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left text-xs font-normal">
            Search commands...
          </span>
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command className="h-3 w-3" />K
          </kbd>
        </Button>

        <Button
          variant="default"
          onClick={() => setAIOpen(true)}
          className="hidden items-center gap-2 rounded-full bg-primary px-4 text-white shadow-sm hover:bg-primary/90 sm:flex"
        >
          <BrainCircuit className="h-4 w-4" />
          <span className="text-xs font-semibold">Agent</span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center gap-1 rounded bg-white/20 px-1 font-mono text-[10px] font-medium text-white">
            <Command className="h-2 w-2" />J
          </kbd>
        </Button>

        <NotificationCenter />

        <DropdownMenu>
          <DropdownMenuTrigger className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-transparent outline-none ring-offset-background transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <Avatar className="h-8 w-8">
              <AvatarImage src={undefined} alt={email} />
              <AvatarFallback className="bg-primary/10 font-medium text-primary">
                {status === "loading" ? "…" : initial}
              </AvatarFallback>
            </Avatar>
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
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              className="focus:bg-destructive/10 focus:text-destructive"
              onClick={handleLogout}
            >
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
