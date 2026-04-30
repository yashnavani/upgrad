"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  FormEvent,
} from "react";
import { useParams } from "next/navigation";
import {
  AgentEventsEnum,
  CommandEventsEnum,
  LiveAvatarSession,
  SessionEvent,
  SessionState,
} from "@heygen/liveavatar-web-sdk";
import ReactMarkdown from "react-markdown";
import { Award, Loader2, Mic, Play, Send } from "lucide-react";

import { apiClient } from "@/lib/api-client";
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

type LiveAvatarToken = {
  session_token: string;
  session_id: string;
};

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  return window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null;
}

/** HeyGen SDK 0.0.17: WebSocket path does not send avatar.speak_text; force LiveKit data channel. */
const LIVEKIT_AGENT_CONTROL_TOPIC = "agent-control";
/** Same host as `@heygen/liveavatar-web-sdk` SessionAPIClient — POST keep-alive to extend sandbox sessions. */
const LIVEAVATAR_PUBLIC_API = "https://api.liveavatar.com";

function patchAvatarSpeakTextUsesLiveKit(avatar: LiveAvatarSession) {
  const a = avatar as unknown as {
    room: {
      state: string;
      localParticipant: {
        publishData: (
          data: Uint8Array,
          opts: { reliable: boolean; topic: string },
        ) => void;
      };
    };
    sendCommandEvent: (cmd: {
      event_id?: string;
      event_type: string;
      text?: string;
    }) => void;
  };
  const orig = a.sendCommandEvent.bind(avatar);
  a.sendCommandEvent = (commandEvent) => {
    const t = commandEvent.event_type;
    if (
      t === CommandEventsEnum.AVATAR_SPEAK_TEXT ||
      t === CommandEventsEnum.AVATAR_SPEAK_RESPONSE
    ) {
      if (a.room.state === "connected") {
        const data = new TextEncoder().encode(JSON.stringify(commandEvent));
        void a.room.localParticipant.publishData(data, {
          reliable: true,
          topic: LIVEKIT_AGENT_CONTROL_TOPIC,
        });
        return;
      }
    }
    orig(commandEvent);
  };
}

function waitUntilAvatarConnected(
  avatar: LiveAvatarSession,
  maxMs: number,
): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  return new Promise((resolve) => {
    const tick = () => {
      if (avatar.state === SessionState.CONNECTED) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      window.setTimeout(tick, 40);
    };
    tick();
  });
}

async function speakThroughAvatar(
  avatar: LiveAvatarSession,
  text: string,
  msMaxWait: number,
): Promise<boolean> {
  const connected = await waitUntilAvatarConnected(avatar, 20_000);
  if (!connected) return false;

  return new Promise((resolve) => {
    let settled = false;
    let speakStarted = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(startupTimer);
      clearTimeout(maxTimer);
      avatar.off(AgentEventsEnum.AVATAR_SPEAK_ENDED, onEnd);
      avatar.off(AgentEventsEnum.AVATAR_SPEAK_STARTED, onStart);
      resolve(ok);
    };
    const onStart = () => {
      speakStarted = true;
      clearTimeout(startupTimer);
    };
    const onEnd = () => {
      clearTimeout(maxTimer);
      finish(true);
    };
    const startupTimer = window.setTimeout(() => {
      if (!speakStarted) finish(false);
    }, 12_000);
    const maxTimer = window.setTimeout(() => finish(false), msMaxWait);
    avatar.on(AgentEventsEnum.AVATAR_SPEAK_STARTED, onStart);
    avatar.on(AgentEventsEnum.AVATAR_SPEAK_ENDED, onEnd);
    try {
      avatar.repeat(text);
    } catch {
      finish(false);
    }
  });
}

export default function InterviewRoomPage() {
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
  const [avatarReady, setAvatarReady] = useState(false);
  const [avatarDisabledReason, setAvatarDisabledReason] = useState<
    string | null
  >(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isAvatarSpeaking, setIsAvatarSpeaking] = useState(false);

  const avatarVideoRef = useRef<HTMLVideoElement>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const avatarSessionRef = useRef<LiveAvatarSession | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
          alert(
            e instanceof APIError
              ? e.message
              : "Failed to send answer.",
          );
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
    const avatar = avatarSessionRef.current;
    if (!s?.transcript?.length) return;
    const last = s.transcript[s.transcript.length - 1];
    if (last?.role !== "model") return;

    setIsAvatarSpeaking(true);
    setRoomStatus("Interviewer is speaking…");
    const text = last.content;
    const cap = Math.min(Math.max(text.length * 55, 4000), 45000);

    let ok = false;
    if (avatar && avatarReady) {
      ok = await speakThroughAvatar(avatar, text, cap);
    }
    if (!ok && avatar && avatarReady) {
      setRoomStatus(
        "HeyGen audio failed — read transcript. Set LIVEAVATAR_VOICE_ID for a female studio voice.",
      );
    } else {
      setRoomStatus("Your turn — type or use the mic.");
    }
    setIsAvatarSpeaking(false);
  }, [avatarReady]);

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
    if (!id || !session || session.status === "completed") return;
    if (session.id !== id) return;

    let cancelled = false;
    const opening = session.transcript[session.transcript.length - 1];
    let openingQuestionPlayed = false;

    let keepAliveInterval: number | null = null;
    const stopLaKeepAlive = () => {
      if (keepAliveInterval != null) {
        window.clearInterval(keepAliveInterval);
        keepAliveInterval = null;
      }
    };
    const startLaKeepAlive = (bearer: string) => {
      stopLaKeepAlive();
      const ping = () => {
        if (cancelled || !bearer) return;
        void fetch(`${LIVEAVATAR_PUBLIC_API}/v1/sessions/keep-alive`, {
          method: "POST",
          headers: { Authorization: `Bearer ${bearer}` },
        }).catch(() => undefined);
      };
      keepAliveInterval = window.setInterval(ping, 45_000);
      ping();
    };

    const boot = async () => {
      setRoomStatus("Starting camera…");
      try {
        let stream: MediaStream | null = null;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (myVideoRef.current) myVideoRef.current.srcObject = stream;
      } catch {
        setRoomStatus("Camera unavailable — text mode still works.");
      }

      setRoomStatus("Checking avatar…");
      let avatarEnabled = false;
      try {
        const st = await apiClient<{ available: boolean }>(
          "/interviews/liveavatar-status",
          { method: "GET" },
        );
        avatarEnabled = st.available;
      } catch {
        avatarEnabled = false;
      }
      if (cancelled) return;
      if (!avatarEnabled) {
        setRoomStatus("Text mode — set LIVEAVATAR_API_KEY and LIVEAVATAR_AVATAR_ID on the server for HeyGen.");
        return;
      }

      setRoomStatus("Connecting avatar…");

      try {
        const tok = await apiClient<LiveAvatarToken>(
          "/interviews/liveavatar-token",
          { method: "POST", skipRetries: true },
        );
        if (cancelled) return;

        const avatar = new LiveAvatarSession(tok.session_token, {
          voiceChat: false,
        });
        avatarSessionRef.current = avatar;
        patchAvatarSpeakTextUsesLiveKit(avatar);

        avatar.on(SessionEvent.SESSION_STREAM_READY, () => {
          if (cancelled) return;
          if (avatarVideoRef.current) {
            avatar.attach(avatarVideoRef.current);
          }
          setAvatarReady(true);
          setRoomStatus("Avatar ready.");
          if (opening?.role === "model" && !openingQuestionPlayed) {
            openingQuestionPlayed = true;
            void (async () => {
              setIsAvatarSpeaking(true);
              setRoomStatus("Interviewer is speaking…");
              const cap = Math.min(
                Math.max(opening.content.length * 55, 4000),
                45000,
              );
              const ok = await speakThroughAvatar(avatar, opening.content, cap);
              setIsAvatarSpeaking(false);
              setRoomStatus(
                ok
                  ? "Your turn — type or use the mic."
                  : "HeyGen audio failed — read transcript. Set LIVEAVATAR_VOICE_ID for a female studio voice.",
              );
            })();
          }
        });

        avatar.on(SessionEvent.SESSION_DISCONNECTED, () => {
          stopLaKeepAlive();
          setAvatarReady(false);
          setRoomStatus((prev) =>
            prev.includes("HeyGen session")
              ? prev
              : "HeyGen disconnected — read transcript; reload page to restore avatar.",
          );
        });

        avatar.on(
          AgentEventsEnum.SESSION_STOPPED,
          (ev: { stop_reason?: string }) => {
            stopLaKeepAlive();
            setAvatarReady(false);
            const r = ev.stop_reason ?? "stopped";
            if (r === "MAX_DURATION_REACHED") {
              setRoomStatus(
                "HeyGen session hit max duration. Reload this page for a fresh avatar (your interview progress is saved).",
              );
            } else {
              setRoomStatus(`HeyGen session ended (${r}). Reload page if you need the avatar again.`);
            }
          },
        );

        await avatar.start();
        if (cancelled) {
          stopLaKeepAlive();
          return;
        }
        startLaKeepAlive(tok.session_token);
      } catch (e) {
        stopLaKeepAlive();
        avatarSessionRef.current = null;
        setAvatarReady(false);
        const msg =
          e instanceof Error ? e.message : "Avatar token or SDK failed.";
        setAvatarDisabledReason(msg);
        setRoomStatus("Avatar off — text interview only.");
      }
    };

    void boot();

    return () => {
      cancelled = true;
      stopLaKeepAlive();
      recognitionRef.current?.stop();
      avatarSessionRef.current?.stop().catch(() => undefined);
      avatarSessionRef.current = null;
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
      setAvatarReady(false);
    };
    // Avatar session is tied to interview id + lifecycle; not every transcript update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, session?.id, session?.status]);

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
    if (isAvatarSpeaking || sending) return;

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
        <p className="text-muted-foreground">
          Interview not found or failed to load.
        </p>
        <Button
          className="mt-4"
          variant="outline"
          onClick={() => window.location.assign("/interview")}
        >
          Back to setup
        </Button>
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
                  <p className="text-xs font-bold uppercase text-muted-foreground">
                    {label}
                  </p>
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
              <ReactMarkdown>
                {session.feedback_data.coaching_report}
              </ReactMarkdown>
            </article>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-6 max-w-6xl space-y-4 px-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-semibold">
          <Award className="h-4 w-4 text-primary" />
          Live interview: {session.target_role}
        </div>
        <Badge variant="outline">
          User turn {session.turn_count + 1} / {session.max_turns}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Follow-ups adapt to your last answer. After your final answer you get four dimension scores
        and a structured coach report (strengths, gaps, practice drills).
      </p>

      {avatarDisabledReason ? (
        <p className="text-xs text-muted-foreground">
          Avatar: {avatarDisabledReason}
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="flex flex-1 flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-xl border border-border bg-black shadow-lg">
            <video
              ref={avatarVideoRef}
              autoPlay
              playsInline
              className="h-full w-full object-cover"
            />
            <div className="absolute bottom-3 right-3 aspect-video w-36 overflow-hidden rounded-lg border-2 border-white/30 bg-muted shadow-lg">
              <video
                ref={myVideoRef}
                autoPlay
                muted
                playsInline
                className="h-full w-full object-cover"
              />
            </div>
            <div className="absolute left-3 top-3 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
              {roomStatus}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              className="flex-1 min-w-[140px]"
              disabled={isAvatarSpeaking || sending}
              onClick={() => void playLatestQuestion()}
            >
              <Play className="mr-2 h-4 w-4" />
              Play question
            </Button>
            <Button
              type="button"
              className={`flex-1 min-w-[140px] ${isRecording ? "bg-red-600 hover:bg-red-600" : ""}`}
              disabled={isAvatarSpeaking || sending}
              onClick={toggleRecording}
            >
              <Mic className="mr-2 h-4 w-4" />
              {isRecording ? "Stop mic" : "Speak answer"}
            </Button>
          </div>
        </div>

        <Card className="flex h-[52vh] w-full flex-col overflow-hidden lg:w-96">
          <div className="border-b bg-muted/30 px-4 py-3 text-sm font-semibold">
            Transcript
          </div>
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
            placeholder="Type your answer (fallback if mic fails)"
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
