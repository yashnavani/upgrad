"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  useEffect(() => {
    // Apply stored or system preference on mount
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const shouldBeDark = stored === "dark" || (!stored && prefersDark);
    
    document.documentElement.classList.toggle("dark", shouldBeDark);
  }, []);

  const toggleTheme = () => {
    const isDark = document.documentElement.classList.contains("dark");
    const newTheme = isDark ? "light" : "dark";
    
    localStorage.setItem("theme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleTheme}
      className="h-9 gap-2 rounded-full border-border/50 px-3 transition-all hover:border-primary/50 hover:bg-primary/5"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="text-xs font-medium dark:hidden">Light</span>
      <span className="hidden text-xs font-medium dark:inline">Dark</span>
    </Button>
  );
}
