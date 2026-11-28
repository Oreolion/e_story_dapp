"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

export function RecorderControl({
  recording,
  busy,
  requesting,
  onToggle,
}: {
  recording: boolean;
  busy: boolean;
  requesting: boolean;
  onToggle: () => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [animated, setAnimated] = useState(false);
  useEffect(() => {
    let visible = false;
    const update = () => setAnimated(visible && !document.hidden);
    const observer =
      typeof IntersectionObserver === "undefined"
        ? null
        : new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            update();
          });
    if (stageRef.current) observer?.observe(stageRef.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer?.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <div
      ref={stageRef}
      className="recorder-stage"
      data-recording={recording}
      data-animated={animated}
    >
      <div aria-hidden="true" className="recorder-halo" />
      <div aria-hidden="true" className="recorder-orbit recorder-orbit-outer" />
      <div aria-hidden="true" className="recorder-orbit" />
      <button
        type="button"
        className="recorder-button"
        onClick={onToggle}
        disabled={busy || requesting}
        aria-label={
          requesting
            ? "Waiting for microphone permission"
            : recording
              ? "Stop recording"
              : "Start recording"
        }
      >
        {requesting || busy ? (
          <Loader2 aria-hidden className="size-9 animate-spin" />
        ) : recording ? (
          <Square aria-hidden className="size-9" />
        ) : (
          <Mic aria-hidden className="size-11" />
        )}
      </button>
      <p role="status" className="relative mt-5 text-sm font-medium">
        {requesting
          ? "Waiting for microphone permission…"
          : recording
            ? "Your voice is being recorded"
            : busy
              ? "Please wait for the current task to finish."
              : "A moment worth keeping starts here"}
      </p>
    </div>
  );
}
