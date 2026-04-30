"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  LayoutDashboard,
  Lightbulb,
  List,
  Settings,
  Workflow,
} from "lucide-react";

import { useUI } from "@/components/providers/UIProvider";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";

export function CommandMenu() {
  const router = useRouter();
  const { isCommandOpen, setCommandOpen, setAIOpen } = useUI();

  const runCommand = React.useCallback(
    (command: () => void) => {
      setCommandOpen(false);
      command();
    },
    [setCommandOpen]
  );

  return (
    <CommandDialog open={isCommandOpen} onOpenChange={setCommandOpen}>
      <Command>
        <CommandInput placeholder="Jump to a page or action…" />
        <CommandList className="hide-scrollbar">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={() => runCommand(() => setAIOpen(true))}>
              <BrainCircuit className="mr-2 h-4 w-4 text-primary" />
              <span>Open agent panel…</span>
              <span className="ml-auto text-xs text-muted-foreground">
                Ctrl+J
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Go to overview</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Agents">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/ai/insights"))}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              <span>Agent insights</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/ai/policies"))}
            >
              <Workflow className="mr-2 h-4 w-4" />
              <span>Policies &amp; tools</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="System">
            <CommandItem onSelect={() => runCommand(() => router.push("/settings"))}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Workspace settings</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/logs"))}>
              <List className="mr-2 h-4 w-4" />
              <span>Run logs</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
