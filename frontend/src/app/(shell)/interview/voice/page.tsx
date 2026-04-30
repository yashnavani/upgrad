"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FileUp, Headphones, Loader2, Mic, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { apiClient } from "@/lib/api-client";

type InterviewCreated = {
  id: string;
};

type ResumeParseOut = {
  text: string;
  truncated: boolean;
  filename: string | null;
};

const MAX_RESUME_CHARS = 50_000;

type ParseNote = { ok: true; msg: string } | { ok: false; msg: string };

export default function VoiceInterviewSetupPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseNote, setParseNote] = useState<ParseNote | null>(null);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [form, setForm] = useState({
    target_role: "",
    focus_area: "mixed",
    resume_snippet: "",
    max_turns: 6,
  });

  const clearResume = () => {
    setForm((f) => ({ ...f, resume_snippet: "" }));
    setUploadedName(null);
    setParseNote(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setParseNote(null);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const out = await apiClient<ResumeParseOut>("/interviews/parse-resume", {
        method: "POST",
        body: fd,
      });
      let text = out.text;
      if (text.length > MAX_RESUME_CHARS) {
        text = text.slice(0, MAX_RESUME_CHARS);
      }
      setForm((f) => ({ ...f, resume_snippet: text }));
      setUploadedName(out.filename || file.name);
      setParseNote({
        ok: true,
        msg: out.truncated
          ? "File was trimmed to fit the interview context limit."
          : "Resume text loaded — interviewer will ask from this.",
      });
    } catch (err) {
      setParseNote({
        ok: false,
        msg: err instanceof Error ? err.message : "Could not read that file.",
      });
      setUploadedName(null);
    } finally {
      setParsing(false);
    }
  };

  const startInterview = async () => {
    if (!form.target_role) return;
    setLoading(true);
    try {
      const res = await apiClient<InterviewCreated>("/interviews", {
        method: "POST",
        body: JSON.stringify(form),
      });
      router.push(`/interview/voice/${res.id}`);
    } catch {
      alert("Failed to start interview.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-2xl space-y-4">
      <p className="text-center text-sm text-muted-foreground">
        Want video + HeyGen avatar?{" "}
        <Link href="/interview" className="text-primary underline underline-offset-2">
          Mock interview (avatar)
        </Link>
      </p>
      <Card className="border-border shadow-lg">
        <CardHeader>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Headphones className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">Voice-only mock interview</CardTitle>
          <CardDescription>
            Same adaptive interviewer and scoring as the avatar flow — audio only via Gemini TTS (no
            HeyGen, no camera). Upload resume, answer by mic or keyboard.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="target_role">
              Target role
            </label>
            <Input
              id="target_role"
              placeholder="e.g. AI Engineer Intern"
              value={form.target_role}
              onChange={(e) => setForm({ ...form, target_role: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="focus_area">
              Focus area
            </label>
            <select
              id="focus_area"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={form.focus_area}
              onChange={(e) => setForm({ ...form, focus_area: e.target.value })}
            >
              <option value="mixed">Mixed</option>
              <option value="behavioral">Behavioral</option>
              <option value="technical">Technical</option>
              <option value="case">Case study</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold" htmlFor="max_turns">
              Interview length
            </label>
            <select
              id="max_turns"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              value={form.max_turns}
              onChange={(e) =>
                setForm({ ...form, max_turns: Number(e.target.value) })
              }
            >
              <option value={5}>5 candidate answers (shorter)</option>
              <option value={6}>6 candidate answers (default)</option>
              <option value={7}>7 candidate answers (deeper)</option>
            </select>
          </div>

          <div className="space-y-2">
            <span className="text-sm font-semibold">Resume</span>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,text/plain,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={(e) => void onFileSelected(e)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={parsing}
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                {parsing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileUp className="h-4 w-4" />
                )}
                Upload resume
              </Button>
              {(uploadedName || form.resume_snippet) && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1 text-muted-foreground"
                  onClick={clearResume}
                >
                  <X className="h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
              {uploadedName ? (
                <span className="text-xs text-muted-foreground">{uploadedName}</span>
              ) : null}
            </div>
            {parseNote ? (
              <p
                className={
                  parseNote.ok
                    ? "text-xs text-emerald-600 dark:text-emerald-400"
                    : "text-xs text-destructive"
                }
              >
                {parseNote.msg}
              </p>
            ) : null}
            <label className="text-xs text-muted-foreground" htmlFor="resume">
              Or paste / edit text (max {MAX_RESUME_CHARS.toLocaleString()} chars).
            </label>
            <Textarea
              id="resume"
              placeholder="Paste resume bullets or edit extracted text…"
              className="min-h-[180px] font-mono text-xs leading-relaxed"
              value={form.resume_snippet}
              onChange={(e) => {
                const v = e.target.value;
                setForm({
                  ...form,
                  resume_snippet: v.slice(0, MAX_RESUME_CHARS),
                });
                if (uploadedName) setUploadedName(null);
                setParseNote(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {form.resume_snippet.length.toLocaleString()} /{" "}
              {MAX_RESUME_CHARS.toLocaleString()} characters
            </p>
          </div>

          <Button
            className="mt-4 h-12 w-full text-md"
            disabled={!form.target_role || loading || parsing}
            onClick={() => void startInterview()}
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Mic className="mr-2 h-5 w-5" />
                Start voice interview
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
