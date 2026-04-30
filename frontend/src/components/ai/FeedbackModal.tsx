"use client";

import { useState } from "react";
import { Brain, Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

export type FeedbackModalProps = {
  isOpen: boolean;
  onClose: () => void;
  originalPrompt: string;
  aiResponse: string;
};

export function FeedbackModal({
  isOpen,
  onClose,
  originalPrompt,
  aiResponse,
}: FeedbackModalProps) {
  const [correction, setCorrection] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setBanner(null);
      onClose();
    }
  };

  const handleTeach = async () => {
    if (!correction.trim()) return;
    setIsSubmitting(true);
    setBanner(null);
    try {
      await apiClient<{ message: string }>("/feedback/teach", {
        method: "POST",
        body: JSON.stringify({
          original_prompt: originalPrompt,
          ai_response: aiResponse,
          correction: correction.trim(),
        }),
      });
      setCorrection("");
      setBanner({ type: "success", text: "Lesson saved. Similar prompts will recall this." });
      window.setTimeout(() => {
        setBanner(null);
        onClose();
      }, 1200);
    } catch {
      setBanner({
        type: "error",
        text: "Could not reach the API. Check your session and network.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md border border-border bg-card">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <Brain className="h-5 w-5" />
            </div>
            <DialogTitle>Teach the AI</DialogTitle>
          </div>
          <DialogDescription>
            Correct the model. Your note is embedded and stored as a durable lesson
            for semantic recall.
          </DialogDescription>
        </DialogHeader>

        {banner ? (
          <p
            className={
              banner.type === "success"
                ? "rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400"
                : "rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {banner.text}
          </p>
        ) : null}

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="mb-1 text-[10px] font-bold tracking-wide text-muted-foreground uppercase">
              Original intent
            </p>
            <p className="line-clamp-3 text-xs text-foreground/80 italic">
              {originalPrompt.trim() ? `“${originalPrompt}”` : "(No prior user turn)"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              What should the AI do instead?
            </label>
            <Textarea
              placeholder="e.g. Never suggest deleting accounts tagged legacy without approval…"
              value={correction}
              onChange={(e) => setCorrection(e.target.value)}
              className="h-32 border-border bg-background"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleTeach()}
            disabled={isSubmitting || !correction.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            Update agent logic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
