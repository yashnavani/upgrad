"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  LayoutDashboard,
  Lightbulb,
  List,
  Settings,
  Users,
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
        <CommandInput placeholder="Type a command or search..." />
        <CommandList className="hide-scrollbar">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Suggestions">
            <CommandItem onSelect={() => runCommand(() => setAIOpen(true))}>
              <BrainCircuit className="mr-2 h-4 w-4 text-primary" />
              <span>Open AI Assistant…</span>
              <span className="ml-auto text-xs text-muted-foreground">
                Ctrl+J
              </span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>Go to Dashboard</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="AI &amp; administration">
            <CommandItem
              onSelect={() => runCommand(() => router.push("/ai/insights"))}
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              <span>AI Insights</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/ai/policies"))}
            >
              <Workflow className="mr-2 h-4 w-4" />
              <span>Rules &amp; Policies</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/admin/users"))}
            >
              <Users className="mr-2 h-4 w-4" />
              <span>Users &amp; Access</span>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="System">
            <CommandItem onSelect={() => runCommand(() => router.push("/logs"))}>
              <List className="mr-2 h-4 w-4" />
              <span>Audit Logs</span>
            </CommandItem>
            <CommandItem
              onSelect={() => runCommand(() => router.push("/settings"))}
            >
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
