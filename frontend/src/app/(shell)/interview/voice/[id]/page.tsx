"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  FormEvent,
} from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { Headphones, Loader2, Mic, Play, Send } from "lucide-react";

import { apiClient, postInterviewVoiceTts } from "@/lib/api-client";
import { APIError } from "@/lib/api-error";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type FeedbackPayload = {
  evaluation: Record<string, unknown>;
  coaching_report: string;
};

type InterviewSession = {
  id: string;
  target_role: string;
  status: string;
  turn_count: number;
  max_turns: number;
  transcript: { role: string; content: string }[];
  feedback_data?: FeedbackPayload;
};

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

function speakBrowserPlain(text: string): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis) {
    return Promise.resolve();
  }
  window.speechSynthesis.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.onend = () => resolve();
    u.onerror = () => resolve();
    window.speechSynthesis.speak(u);
  });
}

export default function VoiceInterviewRoomPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];

  const [session, setSession] = useState<InterviewSession | null>(null);
  const sessionRef = useRef<InterviewSession | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sending, setSending] = useState(false);
  const [roomStatus, setRoomStatus] = useState("Loading…");
  const [isRecording, setIsRecording] = useState(false);
  const [interviewerSpeaking, setInterviewerSpeaking] = useState(false);

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  /** Reject waiters when stopping so overlapping play() / catch never stacks two voices. */
  const audioWaitRejectRef = useRef<((e: Error) => void) | null>(null);
  /** Only latest playInterviewerLine may clear UI (avoids stale finally after overlap). */
  const playGenRef = useRef(0);
  const autoSpokenKeyRef = useRef<string>("");

  const stopAllAudio = useCallback(() => {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    const reject = audioWaitRejectRef.current;
    audioWaitRejectRef.current = null;
    if (reject) {
      reject(new DOMException("playback stopped", "AbortError"));
    }
    const a = currentAudioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
      currentAudioRef.current = null;
    }
  }, []);

  const playInterviewerLine = useCallback(
    async (text: string) => {
      const line = text.trim();
      if (!line) return;
      const gen = ++playGenRef.current;
      stopAllAudio();
      setInterviewerSpeaking(true);
      setRoomStatus("Interviewer speaking (Gemini TTS)…");
      let blobUrl: string | null = null;
      try {
        const blob = await postInterviewVoiceTts(line);
        if (playGenRef.current !== gen) return;
        blobUrl = URL.createObjectURL(blob);
        const audio = new Audio(blobUrl);
        currentAudioRef.current = audio;
        await new Promise<void>((resolve, reject) => {
          audioWaitRejectRef.current = reject;
          const cleanup = () => {
            audioWaitRejectRef.current = null;
            audio.onended = null;
            audio.onerror = null;
          };
          audio.onended = () => {
            cleanup();
            resolve();
          };
          audio.onerror = () => {
            cleanup();
            reject(new Error("audio"));
          };
          void audio.play().catch((err) => {
            cleanup();
            reject(err instanceof Error ? err : new Error(String(err)));
          });
        });
      } catch (e) {
        const aborted =
          e instanceof DOMException && (e.name === "AbortError" || e.message === "playback stopped");
        if (aborted || playGenRef.current !== gen) return;
        stopAllAudio();
        setRoomStatus("Gemini TTS unavailable — browser voice fallback.");
        await speakBrowserPlain(line);
      } finally {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        currentAudioRef.current = null;
        audioWaitRejectRef.current = null;
        if (playGenRef.current === gen) {
          setInterviewerSpeaking(false);
          setRoomStatus("Your turn — mic or type.");
        }
      }
    },
    [stopAllAudio],
  );

  const submitAnswerText = useCallback(
    async (answer: string) => {
      if (!id || !answer.trim()) return;
      const val = answer.trim();
      setSending(true);
      setSession((prev) =>
        prev
          ? {
              ...prev,
              transcript: [...prev.transcript, { role: "user", content: val }],
            }
          : prev,
      );
      const ac = new AbortController();
      const to = window.setTimeout(() => ac.abort(), 120_000);
      try {
        const updated = await apiClient<InterviewSession>(
          `/interviews/${id}/turn`,
          {
            method: "POST",
            body: JSON.stringify({ answer: val }),
            signal: ac.signal,
            skipRetries: true,
          },
        );
        setSession(updated);
        setRoomStatus("Ready.");
      } catch (e) {
        const aborted =
          (e instanceof DOMException && e.name === "AbortError") ||
          (e instanceof Error && /abort/i.test(e.message));
        if (aborted) {
          setRoomStatus("Answer request timed out (120s) — check backend / Gemini.");
        } else {
          alert(e instanceof APIError ? e.message : "Failed to send answer.");
          setRoomStatus("Ready.");
        }
        try {
          const fresh = await apiClient<InterviewSession>(`/interviews/${id}`);
          setSession(fresh);
        } catch {
          /* ignore */
        }
      } finally {
        clearTimeout(to);
        setSending(false);
      }
    },
    [id],
  );

  const playLatestQuestion = useCallback(async () => {
    const s = sessionRef.current;
    if (!s?.transcript?.length) return;
    const last = s.transcript[s.transcript.length - 1];
    if (last?.role !== "model") return;
    await playInterviewerLine(last.content);
  }, [playInterviewerLine]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    apiClient<InterviewSession>(`/interviews/${id}`)
      .then((res) => {
        if (!cancelled) {
          setSession(res);
          setLoadError(false);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError(true);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [session?.transcript, sending]);

  useEffect(() => {
    if (!session || loading || sending || loadError) return;
    const last = session.transcript.at(-1);
    if (!last || last.role !== "model") return;
    const key = `${session.transcript.length}|${session.turn_count}`;
    if (autoSpokenKeyRef.current === key) return;
    autoSpokenKeyRef.current = key;
    void playInterviewerLine(last.content);
  }, [session, loading, sending, loadError, playInterviewerLine]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      stopAllAudio();
    };
  }, [stopAllAudio]);

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending || !id) return;
    const val = input.trim();
    setInput("");
    await submitAnswerText(val);
  };

  const toggleRecording = () => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) {
      alert("Speech recognition needs Chrome or Edge.");
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    if (interviewerSpeaking || sending) return;

    let accumulated = "";
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsRecording(true);
      setRoomStatus("Listening… (click Stop mic when done)");
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let line = "";
      for (let i = 0; i < event.results.length; i += 1) {
        line += event.results[i]?.[0]?.transcript ?? "";
      }
      accumulated = line;
    };

    recognition.onerror = (event: Event) => {
      setIsRecording(false);
      recognitionRef.current = null;
      const err =
        "error" in event && typeof (event as { error?: string }).error === "string"
          ? (event as { error: string }).error
          : "unknown";
      setRoomStatus(`Speech error: ${err}`);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
      const text = accumulated.trim();
      if (text) void submitAnswerText(text);
      else setRoomStatus("No speech captured — try again or type your answer.");
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch {
      setIsRecording(false);
      setRoomStatus("Could not start microphone listening.");
    }
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !session) {
    return (
      <div className="mx-auto mt-16 max-w-md text-center">
        <p className="text-muted-foreground">Interview not found or failed to load.</p>
        <p className="mt-4">
          <Link
            href="/interview/voice"
            className="text-sm font-medium text-primary underline underline-offset-2"
          >
            Back to voice setup
          </Link>
        </p>
      </div>
    );
  }

  if (session.status === "completed" && session.feedback_data) {
    const evalData = session.feedback_data.evaluation;
    const scores: [string, string][] = [
      ["Communication", "communication_score"],
      ["Technical", "technical_accuracy_score"],
      ["Problem solving", "problem_solving_score"],
      ["Behavioral", "behavioral_fit_score"],
    ];
    return (
      <div className="mx-auto mt-6 max-w-4xl space-y-6 duration-500 animate-in fade-in">
        <h1 className="text-3xl font-bold">Interview feedback</h1>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {scores.map(([label, key]) => {
            const score = Number(evalData[key] ?? 0);
            return (
              <Card key={label} className="bg-muted/30">
                <CardContent className="p-4 text-center">
                  <p className="text-xs font-bold uppercase text-muted-foreground">{label}</p>
                  <p
                    className={`mt-2 text-3xl font-black ${
                      score >= 7 ? "text-emerald-500" : "text-amber-500"
                    }`}
                  >
                    {score}/10
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        <Card className="border-primary/20 shadow-lg">
          <CardContent className="max-w-none p-8">
            <article className="text-sm leading-relaxed [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5">
              <ReactMarkdown>{session.feedback_data.coaching_report}</ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-4 px-2">
      <p className="text-center text-sm text-muted-foreground">
        <Link href="/interview/voice" className="text-primary underline underline-offset-2">
          Voice setup
        </Link>
        {" · "}
        <Link href="/interview" className="text-primary underline underline-offset-2">
          Avatar interview
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <Headphones className="h-4 w-4 text-primary" />
          Voice interview: {session.target_role}
        </div>
        <Badge variant="outline">
          User turn {session.turn_count + 1} / {session.max_turns}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Questions are read aloud with Gemini TTS (no HeyGen). Answer with the mic or keyboard.
      </p>

      <div className="rounded-xl border border-border bg-muted/20 p-4">
        <p className="text-sm font-medium text-foreground">Session status</p>
        <p className="mt-1 text-sm text-muted-foreground">{roomStatus}</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 min-w-[140px]"
              disabled={interviewerSpeaking || sending}
              onClick={() => void playLatestQuestion()}
            >
              <Play className="mr-2 h-4 w-4" />
              Play last question
            </Button>
            <Button
              type="button"
              className={`flex-1 min-w-[140px] ${isRecording ? "bg-red-600 hover:bg-red-600" : ""}`}
              disabled={interviewerSpeaking || sending}
              onClick={toggleRecording}
            >
              <Mic className="mr-2 h-4 w-4" />
              {isRecording ? "Stop mic" : "Speak answer"}
            </Button>
          </div>
        </div>

        <Card className="flex h-[52vh] w-full flex-col overflow-hidden lg:w-[28rem]">
          <div className="border-b bg-muted/30 px-4 py-3 text-sm font-semibold">Transcript</div>
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
          >
            {session.transcript.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-2 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex justify-start">
                <div className="flex items-center gap-2 rounded-2xl bg-muted px-4 py-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing…
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>

      <form
        onSubmit={handleSend}
        className="rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <div className="relative flex items-center gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={sending}
            placeholder="Type your answer"
            className="h-12 flex-1 rounded-full pr-12"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || sending}
            className="absolute right-1 h-10 w-10 rounded-full"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
