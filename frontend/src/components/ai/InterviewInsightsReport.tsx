"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Award,
  BookOpen,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Mic,
  Target,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type InterviewSummaryRow = {
  id: string;
  target_role: string;
  focus_area: string;
  resume_snippet: string | null;
  status: string;
  turn_count: number;
  max_turns: number;
  transcript: { role: string; content: string }[];
  feedback_data: {
    evaluation: Record<string, unknown>;
    coaching_report?: string;
  } | null;
  created_at: string;
  updated_at: string;
};

type Dim = { label: string; scoreKey: string; notesKey: string };

const SCORE_DIMS: Dim[] = [
  { label: "Communication", scoreKey: "communication_score", notesKey: "communication_notes" },
  { label: "Technical", scoreKey: "technical_accuracy_score", notesKey: "technical_notes" },
  { label: "Problem solving", scoreKey: "problem_solving_score", notesKey: "problem_solving_notes" },
  { label: "Behavioral fit", scoreKey: "behavioral_fit_score", notesKey: "behavioral_notes" },
];

/** Matches interview feedback page so coach Markdown (headings, lists, numbered drills) renders fully. */
const COACHING_MARKDOWN_CLASS =
  "prose prose-sm max-w-none dark:prose-invert prose-headings:scroll-mt-4 " +
  "[&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:mt-4 [&_h3]:text-base [&_h3]:font-semibold " +
  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:leading-relaxed";

function num(v: unknown): number | null {
  return typeof v === "number" && !Number.isNaN(v) ? v : null;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function ScoreBlock({
  label,
  score,
  notes,
}: {
  label: string;
  score: number;
  notes: string;
}) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100));
  return (
    <div className="rounded-xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="font-mono text-lg font-bold tabular-nums text-primary">{score}/10</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      {notes ? (
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{notes}</p>
      ) : null}
    </div>
  );
}

function CoachingMarkdownBody({ text }: { text: string }) {
  return (
    <article className={COACHING_MARKDOWN_CLASS}>
      <ReactMarkdown>{text}</ReactMarkdown>
    </article>
  );
}

function CompactScores({ evaluation }: { evaluation: Record<string, unknown> }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {SCORE_DIMS.map((d) => {
        const sc = num(evaluation[d.scoreKey]);
        if (sc == null) return null;
        return (
          <div
            key={d.scoreKey}
            className="rounded-lg border border-border bg-muted/30 px-2 py-2 text-center"
          >
            <p className="text-[10px] font-medium uppercase text-muted-foreground">{d.label}</p>
            <p className="font-mono text-sm font-bold text-foreground">{sc}/10</p>
          </div>
        );
      })}
    </div>
  );
}

function SessionMeta({ row }: { row: InterviewSummaryRow }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <Badge variant="outline" className="capitalize">
        {row.focus_area}
      </Badge>
      <span>·</span>
      <span>
        {row.turn_count}/{row.max_turns} turns
      </span>
      <span>·</span>
      <span>Updated {new Date(row.updated_at).toLocaleString()}</span>
    </div>
  );
}

export function InterviewInsightsReport({
  sessions,
}: {
  sessions: InterviewSummaryRow[] | null;
}) {
  const [openOlder, setOpenOlder] = useState(false);
  const list = useMemo(() => sessions ?? [], [sessions]);

  const completed = useMemo(
    () => list.filter((s) => s.status === "completed"),
    [list]
  );
  const inProgress = useMemo(
    () => list.find((s) => s.status === "in_progress"),
    [list]
  );
  const latest = completed[0] ?? null;
  const older = completed.slice(1);

  const avgOverall = useMemo(() => {
    if (!completed.length) return null;
    let sum = 0;
    let n = 0;
    for (const s of completed) {
      const ev = s.feedback_data?.evaluation;
      if (!ev || typeof ev !== "object") continue;
      for (const { scoreKey } of SCORE_DIMS) {
        const v = num(ev[scoreKey]);
        if (v != null) {
          sum += v;
          n += 1;
        }
      }
    }
    if (!n) return null;
    return sum / n;
  }, [completed]);

  if (sessions === null) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-5 w-5 text-primary" />
            Interview report
          </CardTitle>
          <CardDescription>Loading your mock interview sessions…</CardDescription>
        </CardHeader>
        <CardContent className="h-40 animate-pulse rounded-lg bg-muted/50" />
      </Card>
    );
  }

  if (!sessions.length) {
    return (
      <Card className="border border-border shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Mic className="h-5 w-5 text-primary" />
            Interview report
          </CardTitle>
          <CardDescription>
            When you finish a mock interview, scores, coach feedback, and transcript show up here.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <Target className="h-12 w-12 text-muted-foreground/40" />
          <p className="max-w-md text-sm text-muted-foreground">
            No sessions yet. Run a mock interview to get a full AI evaluation and coaching report on this page.
          </p>
          <Link
            href="/interview"
            className={cn(buttonVariants({ size: "lg" }), "rounded-full")}
          >
            Start mock interview
            <ChevronRight className="ml-1 h-4 w-4" />
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Interview report
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Latest AI evaluation, coaching, and transcript from your mock interviews.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="font-mono">
            {completed.length} completed
          </Badge>
          {inProgress ? (
            <Badge className="bg-amber-500/15 text-amber-800 dark:text-amber-200">
              1 in progress
            </Badge>
          ) : null}
          {avgOverall != null ? (
            <Badge variant="outline" className="font-mono">
              Avg score (all dims) {avgOverall.toFixed(1)}/10
            </Badge>
          ) : null}
        </div>
      </div>

      {inProgress ? (
        <Card className="border border-amber-500/30 bg-amber-50/40 dark:bg-amber-950/20">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <MessageSquare className="h-4 w-4 text-amber-600" />
              <span className="text-foreground">
                Interview in progress: <strong>{inProgress.target_role}</strong>
              </span>
            </div>
            <Link
              href={`/interview/${inProgress.id}`}
              className={cn(buttonVariants({ variant: "default", size: "sm" }), "rounded-full")}
            >
              Continue
              <ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {!latest ? (
        <Card className="border border-border shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No completed interview yet. Finish all turns in a session to unlock the full report.
            {inProgress ? (
              <div className="mt-4">
                <Link href={`/interview/${inProgress.id}`} className={cn(buttonVariants(), "rounded-full")}>
                  Resume interview
                </Link>
              </div>
            ) : (
              <div className="mt-4">
                <Link href="/interview" className={cn(buttonVariants(), "rounded-full")}>
                  Start mock interview
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden border border-border shadow-sm">
          <CardHeader className="border-b border-border bg-muted/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                  <Award className="h-5 w-5 shrink-0 text-primary" />
                  {latest.target_role}
                </CardTitle>
                <CardDescription className="mt-2">
                  <SessionMeta row={latest} />
                </CardDescription>
              </div>
              <Link
                href={`/interview/${latest.id}`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0 rounded-full")}
              >
                Open session
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 pt-6">
            {latest.feedback_data?.evaluation ? (
              <div>
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Scores & evaluator notes
                </h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {SCORE_DIMS.map((d) => {
                    const sc = num(latest.feedback_data!.evaluation[d.scoreKey]);
                    const notes = str(latest.feedback_data!.evaluation[d.notesKey]);
                    if (sc == null) return null;
                    return (
                      <ScoreBlock key={d.scoreKey} label={d.label} score={sc} notes={notes} />
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No structured evaluation stored for this session.</p>
            )}

            <div>
              <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <BookOpen className="h-4 w-4 text-primary" />
                Structured coaching feedback
              </h3>
              <p className="mb-4 text-xs leading-relaxed text-muted-foreground">
                End-of-interview coach output: overall impression, strengths, gaps and missed
                opportunities, exactly three numbered practice drills, and a quick score recap—same
                structure as when you finish in Mock interview.
              </p>
              {latest.feedback_data?.coaching_report?.trim() ? (
                <div className="max-h-[min(70vh,720px)] overflow-y-auto rounded-xl border border-primary/20 bg-muted/15 p-5 shadow-inner">
                  <CoachingMarkdownBody text={latest.feedback_data.coaching_report} />
                </div>
              ) : latest.feedback_data?.evaluation ? (
                <p className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  Scores are saved but no coaching narrative was stored. Open the session to retry
                  or run another completed interview.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No coaching output for this session.</p>
              )}
            </div>

            <details className="group rounded-xl border border-border bg-card">
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                <span className="flex items-center gap-2">
                  <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                  Full transcript ({latest.transcript.length} messages)
                </span>
              </summary>
              <div className="space-y-3 border-t border-border px-4 py-4 text-sm">
                {latest.transcript.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={cn(
                      "rounded-lg border px-3 py-2",
                      m.role === "user"
                        ? "border-primary/20 bg-primary/5"
                        : "border-border bg-muted/30"
                    )}
                  >
                    <span className="text-xs font-semibold uppercase text-muted-foreground">
                      {m.role === "user" ? "You" : "Interviewer"}
                    </span>
                    <p className="mt-1 whitespace-pre-wrap text-foreground/90">{m.content}</p>
                  </div>
                ))}
              </div>
            </details>

            {latest.resume_snippet ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Resume snippet used
                </h3>
                <pre className="max-h-48 overflow-auto rounded-lg border border-border bg-muted/30 p-3 text-xs whitespace-pre-wrap">
                  {latest.resume_snippet}
                </pre>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {older.length > 0 ? (
        <Card className="border border-border shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Earlier completed interviews</CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setOpenOlder((o) => !o)}
            >
              {openOlder ? "Hide" : `Show ${older.length}`}
            </Button>
          </CardHeader>
          {openOlder ? (
            <CardContent className="divide-y divide-border border-t border-border p-0">
              {older.map((row) => (
                <div key={row.id} className="space-y-3 px-4 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{row.target_role}</p>
                      <SessionMeta row={row} />
                    </div>
                    <Link
                      href={`/interview/${row.id}`}
                      className={cn(buttonVariants({ variant: "outline", size: "sm" }), "rounded-full")}
                    >
                      Open session
                    </Link>
                  </div>
                  {row.feedback_data?.evaluation ? (
                    <CompactScores evaluation={row.feedback_data.evaluation} />
                  ) : null}
                  {row.feedback_data?.coaching_report?.trim() ? (
                    <details className="group rounded-lg border border-border bg-card">
                      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2">
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                          Full structured coaching feedback
                        </span>
                      </summary>
                      <div className="max-h-[min(50vh,480px)] overflow-y-auto border-t border-border p-4">
                        <CoachingMarkdownBody text={row.feedback_data.coaching_report} />
                      </div>
                    </details>
                  ) : null}
                </div>
              ))}
            </CardContent>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
