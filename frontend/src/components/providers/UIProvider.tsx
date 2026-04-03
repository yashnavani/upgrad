"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface UIContextType {
  isCommandOpen: boolean;
  setCommandOpen: (open: boolean) => void;
  toggleCommand: () => void;
  isAIOpen: boolean;
  setAIOpen: (open: boolean) => void;
  toggleAI: () => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error("useUI must be used within a UIProvider");
  }
  return context;
}

export function UIProvider({ children }: { children: React.ReactNode }) {
  const [isCommandOpen, setCommandOpen] = useState(false);
  const [isAIOpen, setAIOpen] = useState(false);

  const toggleCommand = useCallback(() => setCommandOpen((prev) => !prev), []);
  const toggleAI = useCallback(() => setAIOpen((prev) => !prev), []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandOpen((open) => !open);
      }
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setAIOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  return (
    <UIContext.Provider
      value={{
        isCommandOpen,
        setCommandOpen,
        toggleCommand,
        isAIOpen,
        setAIOpen,
        toggleAI,
      }}
    >
      {children}
    </UIContext.Provider>
  );
}
