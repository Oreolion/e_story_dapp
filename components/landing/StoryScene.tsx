"use client";
import { useState } from "react";
import Image from "next/image";
import { ArrowRight, Mic, BookOpen, AlignLeft } from "lucide-react";
const stages = ["Voice", "Words", "Chapter"] as const;
const heights = [
  12, 22, 16, 34, 46, 28, 54, 40, 25, 49, 62, 38, 20, 43, 29, 52, 32, 19, 37,
  23, 14,
];
export function StoryScene() {
  const [stage, setStage] = useState(0);
  return (
    <div className="story-scene" data-stage={stage}>
      <div className="scene-caption">
        <span>ONE MOMENT, MANY POSSIBILITIES</span>
        <span aria-hidden>{String(stage + 1).padStart(2, "0")} / 03</span>
      </div>
      <div className="scene-art">
        <div className="scene-book" aria-hidden="true">
          <Image
            src="/landing/kitchen-memory-v1.webp"
            alt=""
            fill
            unoptimized
            priority
            sizes="(min-width: 768px) 30vw, 75vw"
            className="scene-cover-image"
          />
          <span className="scene-book-edition">THE PERSONAL COLLECTION</span>
          <p>
            The things
            <br />I don’t want
            <br />
            to <em>forget.</em>
          </p>
          <span className="scene-book-foot">A LIFE IN YOUR OWN WORDS</span>
        </div>
        <div className="scene-paper">
          <div className="scene-paper-meta">
            <span>From the everyday</span>
            <span aria-hidden>↗</span>
          </div>
          <p className="scene-paper-title">
            Sunday, at the
            <br />
            <em>kitchen table.</em>
          </p>
          <div className="scene-rule" />
          <p className="scene-paper-excerpt">
            She handed me the recipe without looking at the page. Every line was
            a story she had never written down.
          </p>
          <p className="scene-paper-note">
            Some things deserve more than a passing thought.
          </p>
          <div className="scene-paper-footer">
            <span>Fictional story sample</span>
            <BookOpen aria-hidden className="size-4" />
          </div>
        </div>
        <div className="scene-voice">
          <span className="scene-mic">
            <Mic aria-hidden className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="scene-voice-label">A story begins with your voice</p>
            <div className="scene-wave" aria-hidden>
              {heights.map((height, i) => (
                <i key={i} style={{ height: `${height / 2}px` }} />
              ))}
            </div>
          </div>
          <span className="scene-voice-mark" aria-hidden>
            ↗
          </span>
        </div>
        <span className="scene-gold-thread" aria-hidden />
      </div>
      <div
        className="scene-controls"
        role="tablist"
        aria-label="Explore an illustrative story"
      >
        {stages.map((name, i) => {
          const Icon = [Mic, AlignLeft, BookOpen][i];
          return (
            <button
              key={name}
              id={`sample-tab-${i}`}
              type="button"
              role="tab"
              aria-controls="sample-description"
              aria-selected={stage === i}
              tabIndex={stage === i ? 0 : -1}
              onClick={() => setStage(i)}
              onKeyDown={(event) => {
                const next =
                  event.key === "ArrowRight"
                    ? (i + 1) % 3
                    : event.key === "ArrowLeft"
                      ? (i + 2) % 3
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? 2
                          : null;
                if (next !== null) {
                  event.preventDefault();
                  setStage(next);
                  (
                    event.currentTarget.parentElement?.children[
                      next
                    ] as HTMLElement
                  )?.focus();
                }
              }}
            >
              <Icon aria-hidden className="size-4" />
              {name}
            </button>
          );
        })}
      </div>
      <div
        id="sample-description"
        role="tabpanel"
        aria-labelledby={`sample-tab-${stage}`}
        className="scene-description"
      >
        <p>
          {
            [
              "Start with a spoken moment. No perfect opening line required.",
              "Shape the details in your own words. You remain the author.",
              "Give individual moments a home in a collection you can revisit.",
            ][stage]
          }
        </p>
        <button
          type="button"
          onClick={() => setStage((stage + 1) % 3)}
          aria-label="Explore the next form of this sample story"
        >
          <ArrowRight aria-hidden className="size-4" />
        </button>
      </div>
      <p className="scene-example-label">
        Illustrative example · no recording or AI processing
      </p>
    </div>
  );
}
