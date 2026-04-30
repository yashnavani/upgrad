"use client";

import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Brain,
  BrainCircuit,
  Loader2,
  Send,
  ThumbsDown,
  ThumbsUp,
  Wrench,
  X,
} from "lucide-react";

import { FeedbackModal } from "@/components/ai/FeedbackModal";
import { useUI } from "@/components/providers/UIProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { apiClient } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type MessageRole = "user" | "model";

interface ChatMessage {
  role: MessageRole;
  content: string;
}

interface ToolCall {
  tool_name: string;
  args: Record<string, unknown>;
}

interface ChatApiResponse {
  reply: string;
  tools_used?: ToolCall[];
}

function precedingUserContent(messages: ChatMessage[], modelIdx: number): string {
  for (let i = modelIdx - 1; i >= 0; i--) {
    if (messages[i].role === "user") return messages[i].content;
  }
  return "";
}

export function AIChatbot() {
  const { isAIOpen, setAIOpen } = useUI();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "model",
      content:
        "I'm your workspace agent. Ask about policies, run summaries, or draft steps for a client deployment — I'll use tools when the backend allows.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [lastTools, setLastTools] = useState<ToolCall[]>([]);
  const [feedbackModal, setFeedbackModal] = useState<{
    open: boolean;
    prompt: string;
    response: string;
  }>({ open: false, prompt: "", response: "" });
  const [thanksIdx, setThanksIdx] = useState<number | null>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = scrollAnchorRef.current?.parentElement;
    if (viewport) {
      viewport.scrollTop = viewport.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    const newHistory = [...messages, userMessage];

    setMessages(newHistory);
    setInput("");
    setIsLoading(true);
    setLastTools([]);

    try {
      const data = await apiClient<ChatApiResponse>("/ai/chat", {
        method: "POST",
        body: JSON.stringify({
          message: userMessage.content,
          history: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      setMessages([...newHistory, { role: "model", content: data.reply }]);
      if (data.tools_used?.length) {
        setLastTools(data.tools_used);
      }
    } catch (error) {
      console.error(error);
      setMessages([
        ...newHistory,
        {
          role: "model",
          content:
            "Agent error: could not verify identity or reach the backend.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isAIOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAIOpen(false)}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed right-4 bottom-4 z-50 flex h-[600px] max-h-[80vh] w-full max-w-[400px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl sm:right-8 sm:bottom-8"
            role="dialog"
            aria-label="Agent assistant"
          >
            <div className="flex items-center justify-between border-b border-sidebar-border bg-sidebar px-4 py-3 text-white">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-primary/20 p-1.5">
                  <BrainCircuit className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Workspace agent</h3>
                  <p className="text-[10px] text-sidebar-foreground">
                    Tools + policies enabled
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setAIOpen(false)}
                className="text-sidebar-foreground hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <ScrollArea className="min-h-0 flex-1 bg-background p-4">
              <div ref={scrollAnchorRef} className="space-y-4 pr-2">
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "flex",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "relative max-w-[85%]",
                        msg.role === "model" && "group pl-9 sm:pl-10"
                      )}
                    >
                      {msg.role === "model" && (
                        <div className="absolute top-1 left-0 z-10 flex flex-col gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            title="Helpful"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={() => {
                              setThanksIdx(idx);
                              window.setTimeout(() => setThanksIdx(null), 2500);
                            }}
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Disagree — teach a correction"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            onClick={() =>
                              setFeedbackModal({
                                open: true,
                                prompt: precedingUserContent(messages, idx),
                                response: msg.content,
                              })
                            }
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            title="Correct this answer"
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-primary"
                            onClick={() =>
                              setFeedbackModal({
                                open: true,
                                prompt: precedingUserContent(messages, idx),
                                response: msg.content,
                              })
                            }
                          >
                            <Brain className="h-3.5 w-3.5" />
                          </button>
                          {thanksIdx === idx ? (
                            <span className="text-[9px] text-emerald-600 dark:text-emerald-400">
                              Thanks
                            </span>
                          ) : null}
                        </div>
                      )}
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-2.5 text-sm",
                          msg.role === "user"
                            ? "max-w-full rounded-br-sm bg-primary text-white shadow-sm"
                            : "rounded-bl-sm border border-border bg-card text-foreground shadow-sm"
                        )}
                      >
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="flex max-w-[85%] items-center gap-2 rounded-2xl rounded-bl-sm border border-border bg-card px-4 py-3 text-foreground shadow-sm">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">
                        Running…
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {lastTools.length > 0 && !isLoading && (
              <div className="hide-scrollbar flex items-center gap-2 overflow-x-auto border-t border-primary/10 bg-primary/5 px-4 py-2">
                <Wrench className="h-3 w-3 shrink-0 text-primary" />
                {lastTools.map((tool, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-[10px] whitespace-nowrap text-primary"
                  >
                    {tool.tool_name}()
                  </span>
                ))}
              </div>
            )}

            <form
              onSubmit={(e) => void handleSend(e)}
              className="flex items-center gap-2 border-t border-border bg-card p-3"
            >
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask the agent to do something..."
                className="flex-1 rounded-full border-transparent bg-muted/50 focus-visible:bg-background focus-visible:ring-primary"
                disabled={isLoading}
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || isLoading}
                className="shrink-0 rounded-full bg-primary text-white hover:bg-primary/90"
              >
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </motion.div>

          <FeedbackModal
            isOpen={feedbackModal.open}
            onClose={() =>
              setFeedbackModal((s) => ({ ...s, open: false }))
            }
            originalPrompt={feedbackModal.prompt}
            aiResponse={feedbackModal.response}
          />
        </>
      )}
    </AnimatePresence>
  );
}
