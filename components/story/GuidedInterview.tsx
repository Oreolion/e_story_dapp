"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { aiActionErrorMessage } from "@/lib/ai/messages";
import {
  interviewQuestion,
  interviewTurn,
  MAX_ANSWER_LENGTH,
  MAX_INTERVIEW_TURNS,
  STARTER_QUESTION,
  type InterviewTurn,
} from "@/lib/story/interview";
import { Mic, Square, ArrowRight, Loader2 } from "lucide-react";

const draftContract = z
  .object({
    topic: z.string().max(200),
    question: z.union([z.literal(""), interviewQuestion.shape.question]),
    answer: z.string().max(MAX_ANSWER_LENGTH),
    turns: z.array(interviewTurn).max(MAX_INTERVIEW_TURNS),
    exported: z.number().int().min(0).max(MAX_INTERVIEW_TURNS),
  })
  .strict()
  .refine((value) => value.exported <= value.turns.length);
const emptyDraft = () => ({
  topic: "",
  question: STARTER_QUESTION,
  answer: "",
  turns: [] as InterviewTurn[],
  exported: 0,
});

type InterviewProps = {
  ownerId: string;
  active: boolean;
  disabled?: boolean;
  onAddToStory: (turns: InterviewTurn[]) => void;
};
export function GuidedInterview(props: InterviewProps) {
  return <InterviewSession key={props.ownerId} {...props} />;
}
function InterviewSession({
  ownerId,
  active,
  disabled = false,
  onAddToStory,
}: InterviewProps) {
  const { getAccessToken } = useAuth();
  const key = `estories_interview_v1:${ownerId}`;
  const [draft, setDraft] = useState(emptyDraft);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");
  const [storageWarning, setStorageWarning] = useState(false);
  const locked = useRef(false);
  const alive = useRef(true);
  const captureEpoch = useRef(0);
  const controller = useRef<AbortController | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(key);
      if (stored) {
        const result = draftContract.safeParse(JSON.parse(stored));
        if (result.success) setDraft(result.data);
      }
    } catch {
      setStorageWarning(true);
    }
    setRestored(true);
  }, [key]);
  useEffect(() => {
    if (!restored) return;
    try {
      // The editor saves separately. Never persist an acknowledgement that
      // could prevent recovery if that other write was delayed or failed.
      sessionStorage.setItem(key, JSON.stringify({ ...draft, exported: 0 }));
    } catch {
      setStorageWarning(true);
    }
  }, [draft, key, restored]);
  const stopMedia = () => {
    if (timer.current) clearTimeout(timer.current);
    if (recorder.current?.state === "recording") recorder.current.stop();
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  };
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      captureEpoch.current++;
      controller.current?.abort();
      stopMedia();
    };
  }, []);
  useEffect(() => {
    if (!active) {
      captureEpoch.current++;
      controller.current?.abort();
      stopMedia();
      setRecording(false);
    }
  }, [active]);

  const headers = async (signal: AbortSignal) => {
    const token = await getAccessToken();
    if (signal.aborted || !alive.current || !activeRef.current)
      throw new DOMException("Cancelled", "AbortError");
    return {
      "x-profile-owner-id": ownerId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };
  const ask = async () => {
    if (locked.current || disabled || recording) return;
    const answer = draft.answer.trim();
    const turns = answer
      ? [...draft.turns, { question: draft.question, answer }]
      : draft.turns;
    if (
      !turns.length ||
      turns.length >= MAX_INTERVIEW_TURNS ||
      (!answer && draft.question)
    )
      return;
    locked.current = true;
    setBusy(true);
    setError("");
    // Commit the author's answer locally before inference. Failure cannot erase it.
    setDraft((previous) => ({ ...previous, turns, answer: "", question: "" }));
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 30_000);
    try {
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        credentials: "same-origin",
        signal: abort.signal,
        headers: {
          ...(await headers(abort.signal)),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ topic: draft.topic, turns }),
      });
      const body: unknown = await response.json();
      if (!response.ok) {
        setError(
          aiActionErrorMessage(
            body as Record<string, unknown>,
            "The next question is unavailable. Retry, or add your answers to the story.",
          ),
        );
        return;
      }
      const result = interviewQuestion.safeParse(body);
      if (!result.success) throw new Error("Invalid question");
      if (!abort.signal.aborted && alive.current)
        setDraft((previous) => ({
          ...previous,
          question: result.data.question,
        }));
    } catch {
      if (alive.current && activeRef.current)
        setError(
          "The next question is unavailable. Your answers are kept; you can retry or finish here.",
        );
    } finally {
      clearTimeout(timeout);
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const startRecording = async () => {
    if (
      locked.current ||
      recording ||
      recorder.current?.state === "recording" ||
      disabled
    )
      return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError(
        "Recording is unavailable in this browser. You can type your answer.",
      );
      return;
    }
    locked.current = true;
    setError("");
    const epoch = captureEpoch.current;
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (
        !alive.current ||
        !activeRef.current ||
        epoch !== captureEpoch.current
      ) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream.current = media;
      const mimeType = ["audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const capture = new MediaRecorder(
        media,
        mimeType ? { mimeType } : undefined,
      );
      recorder.current = capture;
      const chunks: Blob[] = [];
      let bytes = 0;
      capture.ondataavailable = (event) => {
        bytes += event.data.size;
        if (bytes > 8 * 1024 * 1024) {
          setError(
            "That answer is too large. Please record a shorter answer or type it.",
          );
          stopMedia();
        } else if (event.data.size) chunks.push(event.data);
      };
      capture.onerror = () => {
        capture.onstop = null;
        stopMedia();
        if (alive.current) {
          setRecording(false);
          setError(
            "Recording stopped unexpectedly. Your typed answer is kept.",
          );
        }
      };
      capture.onstop = async () => {
        stopMedia();
        if (!alive.current) return;
        setRecording(false);
        if (
          !activeRef.current ||
          epoch !== captureEpoch.current ||
          bytes > 8 * 1024 * 1024 ||
          !chunks.length
        )
          return;
        locked.current = true;
        setBusy(true);
        const abort = new AbortController();
        controller.current = abort;
        const timeout = setTimeout(() => abort.abort(), 35_000);
        try {
          const audio = new Blob(chunks, {
            type: capture.mimeType || mimeType || "audio/webm",
          });
          const form = new FormData();
          form.append("file", audio, "answer");
          const response = await fetch("/api/ai/transcribe", {
            method: "POST",
            credentials: "same-origin",
            signal: abort.signal,
            headers: await headers(abort.signal),
            body: form,
          });
          const body = await response.json();
          if (!response.ok) {
            setError(
              aiActionErrorMessage(
                body,
                "Transcription is unavailable. Your typed answer is unchanged.",
              ),
            );
            return;
          }
          const text = z
            .string()
            .trim()
            .min(1)
            .max(MAX_ANSWER_LENGTH)
            .safeParse(body.text);
          if (!text.success) {
            setError(
              "The transcript is empty or too long. Please type your answer or try a shorter recording.",
            );
            return;
          }
          if (!abort.signal.aborted && alive.current) {
            const combined = [draftRef.current.answer, text.data]
              .filter(Boolean)
              .join(" ");
            if (combined.length > MAX_ANSWER_LENGTH) {
              setError(
                "This answer is full. Shorten the typed answer before recording more.",
              );
            } else {
              setDraft((previous) => ({ ...previous, answer: combined }));
            }
          }
        } catch {
          if (alive.current && activeRef.current)
            setError(
              "Could not transcribe this recording. You can type your answer.",
            );
        } finally {
          clearTimeout(timeout);
          locked.current = false;
          if (alive.current) setBusy(false);
        }
      };
      capture.start(1000);
      setRecording(true);
      timer.current = setTimeout(() => stopMedia(), 90_000);
    } catch {
      stopMedia();
      if (alive.current)
        setError(
          "Microphone access was unavailable. You can type your answer.",
        );
    } finally {
      locked.current = false;
    }
  };
  const add = () => {
    const turns =
      draft.answer.trim() && draft.question
        ? [
            ...draft.turns,
            { question: draft.question, answer: draft.answer.trim() },
          ]
        : draft.turns;
    if (turns.length <= draft.exported || busy || recording) return;
    onAddToStory(turns.slice(draft.exported));
    setDraft((previous) => ({
      ...previous,
      turns,
      answer: "",
      question: "",
      exported: turns.length,
    }));
  };
  return (
    <section
      hidden={!active}
      aria-labelledby="interview-heading"
      className="rounded-2xl border bg-card p-5 sm:p-8 space-y-5"
    >
      <div>
        <p className="eyebrow">Guided interview</p>
        <h2 id="interview-heading" className="text-2xl font-display">
          A little help finding the words.
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Start with a question, then choose whether to request an AI follow-up.
          Skip anything you would rather keep to yourself.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="interview-topic">Topic (optional)</Label>
        <Input
          id="interview-topic"
          maxLength={200}
          value={draft.topic}
          disabled={busy || recording || disabled}
          onChange={(event) =>
            setDraft({ ...draft, topic: event.target.value })
          }
          placeholder="A person, a place, a turning point…"
        />
      </div>
      {draft.turns.length > 0 && (
        <ol className="space-y-3" aria-label="Completed answers">
          {draft.turns.map((turn, index) => (
            <li key={index} className="border-l-2 border-primary/40 pl-4">
              <p className="text-sm text-muted-foreground">{turn.question}</p>
              <p className="whitespace-pre-wrap break-words">{turn.answer}</p>
            </li>
          ))}
        </ol>
      )}
      <div aria-live="polite">
        <p className="eyebrow">
          {draft.question === STARTER_QUESTION
            ? "Starter question · no AI used"
            : draft.question
              ? `AI question · answer ${draft.turns.length + 1} of ${MAX_INTERVIEW_TURNS}`
              : "Your answer has been kept"}
        </p>
        {draft.question && (
          <h3 className="mt-2 text-xl font-display">{draft.question}</h3>
        )}
      </div>
      {draft.question && (
        <div className="space-y-2">
          <Label htmlFor="interview-answer">Your answer</Label>
          <Textarea
            id="interview-answer"
            value={draft.answer}
            maxLength={MAX_ANSWER_LENGTH}
            rows={5}
            disabled={busy || disabled}
            onChange={(event) =>
              setDraft({ ...draft, answer: event.target.value })
            }
            placeholder="Tell it in your own words…"
          />
          <p className="text-xs text-muted-foreground">
            {draft.answer.length} / {MAX_ANSWER_LENGTH} characters
          </p>
          <Button
            variant="outline"
            onClick={recording ? stopMedia : startRecording}
            disabled={busy || disabled}
          >
            {recording ? (
              <Square aria-hidden className="size-4" />
            ) : (
              <Mic aria-hidden className="size-4" />
            )}
            {recording ? "Stop answer recording" : "Record an answer"}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={ask}
          disabled={
            busy ||
            recording ||
            disabled ||
            (!draft.answer.trim() && !!draft.question) ||
            draft.turns.length + (draft.answer.trim() ? 1 : 0) >=
              MAX_INTERVIEW_TURNS
          }
        >
          {busy ? (
            <Loader2 aria-hidden className="size-4 animate-spin" />
          ) : (
            <ArrowRight aria-hidden className="size-4" />
          )}
          {!draft.question && error && !busy
            ? "Retry next question"
            : "Next AI question"}
        </Button>
        <Button
          variant="outline"
          disabled={
            busy ||
            recording ||
            disabled ||
            draft.turns.length + (draft.answer.trim() ? 1 : 0) <= draft.exported
          }
          onClick={add}
        >
          {draft.exported &&
          draft.exported === draft.turns.length &&
          !draft.answer
            ? "Added to story below"
            : "Add answers to story"}
        </Button>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Next AI question sends this topic and these answers to the configured AI
        provider. Recording sends audio for transcription and stops after 90
        seconds. Both depend on AI availability. Review the text below before
        saving. Unsaved answers are stored in this browser tab, without vault
        encryption.
      </p>
      {storageWarning && (
        <p role="status" className="text-sm">
          Browser draft storage is unavailable. Keep this page open until you
          copy or save your answers.
        </p>
      )}
      <Button
        variant="ghost"
        disabled={busy || recording || disabled}
        onClick={() => {
          if (
            window.confirm(
              "Clear this interview draft? Text already added to your story will stay.",
            )
          ) {
            setDraft(emptyDraft());
            setError("");
          }
        }}
      >
        Clear interview draft
      </Button>
    </section>
  );
}
