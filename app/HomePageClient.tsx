"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Mic,
  MessageCircle,
  Lock,
  Check,
  Mail,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trackLead } from "@/lib/meta-pixel";

function StoryPreview() {
  const [interview, setInterview] = useState(false);
  return (
    <div className="relative min-w-0 py-5 sm:px-5">
      <div
        aria-hidden
        className="absolute inset-x-5 top-10 bottom-0 rounded-xl border bg-secondary rotate-3"
      />
      <article
        id="story-example"
        aria-label="Illustrative story example"
        className="relative rounded-xl border bg-card p-6 sm:p-9 shadow-[0_18px_55px_-28px_#33250d55]"
      >
        <div className="flex items-center justify-between gap-3 border-b pb-5">
          <span className="eyebrow">From the everyday archive</span>
          <BookOpen aria-hidden className="size-5 text-primary shrink-0" />
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Illustrative example · not a real user’s story
        </p>
        <h2 className="font-display text-3xl sm:text-4xl mt-3 leading-tight">
          The long way
          <br />
          home.
        </h2>
        <div
          className="flex gap-1 items-center h-12 my-5 text-primary"
          aria-hidden
        >
          {[
            4, 8, 15, 10, 24, 31, 20, 13, 27, 36, 20, 10, 25, 16, 8, 19, 29, 15,
            9, 4,
          ].map((height, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-current opacity-60"
              style={{ height }}
            />
          ))}
          <span className="ml-3 text-xs text-muted-foreground">
            A moment, remembered
          </span>
        </div>
        <div className="min-h-38" aria-live="polite">
          {interview ? (
            <>
              <p className="text-sm font-medium text-primary">
                What do you remember about that walk?
              </p>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                “We missed the last bus, so we walked. By the time we reached
                the gate, the argument didn’t matter anymore.”
              </p>
            </>
          ) : (
            <p className="font-display text-xl leading-relaxed">
              “We missed the last bus, so we walked. I remember the quiet
              streets, the light in the kitchen window, and how glad I was that
              we took the long way home.”
            </p>
          )}
        </div>
        <div className="border-t pt-5 mt-6 flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock aria-hidden className="size-3" />
            Private draft example
          </span>
          <button
            onClick={() => setInterview((value) => !value)}
            className="text-sm underline underline-offset-4 min-h-11"
            aria-controls="story-example"
            aria-pressed={interview}
          >
            {interview ? "See monologue example" : "See interview example"}
          </button>
        </div>
      </article>
    </div>
  );
}
function MobileWaitlist() {
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/waitlist", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? "Please wait a little before trying again."
            : "Could not join the list. Check your email and try again.",
        );
        return;
      }
      setDone(true);
      setEmail("");
      trackLead({
        content_name: "Mobile App Waitlist",
        content_category: "pre_launch",
      });
    } catch {
      setError("Could not connect. Please try again.");
    } finally {
      setPending(false);
    }
  };
  return (
    <section className="border-t pt-10 flex flex-col md:flex-row justify-between gap-6">
      <div>
        <p className="eyebrow">Take your archive with you</p>
        <h2 className="font-display text-2xl mt-2">
          The mobile app is on its way.
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          Leave your email for a launch update.
        </p>
      </div>
      {done ? (
        <p role="status" className="flex items-center gap-2">
          <Check aria-hidden className="size-4" />
          You’re on the list.
        </p>
      ) : (
        <form onSubmit={submit} className="w-full md:max-w-md">
          <label htmlFor="mobile-waitlist" className="text-sm">
            Email address
          </label>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <Input
              id="mobile-waitlist"
              className="min-w-0 flex-1 h-11"
              type="email"
              autoComplete="email"
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              placeholder="you@example.com"
            />
            <Button variant="outline" type="submit" disabled={pending}>
              <Mail aria-hidden className="size-4" />
              {pending ? "Joining…" : "Keep me posted"}
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive mt-2">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
export default function HomePage() {
  const { profile } = useAuth();
  return (
    <div className="space-y-20 sm:space-y-28 pb-8">
      <section className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-16 items-center pt-6 sm:pt-12">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-2">
            <span className="w-6 h-px bg-primary" />
            {profile ? "Your living archive" : "For a life worth remembering"}
          </p>
          <h1 className="font-display text-[clamp(2.75rem,6vw,5rem)] tracking-[-.035em] leading-[1.05] mt-6">
            {profile ? (
              <>
                There’s a story
                <br />
                in today, too.
              </>
            ) : (
              <>
                Life moves fast.
                <br />
                <span className="text-primary italic">Keep the stories.</span>
              </>
            )}
          </h1>
          <p className="max-w-md text-lg text-muted-foreground leading-relaxed mt-6">
            A conversation you don’t want to forget. A place that changed you.
            Speak or write it down, and make room for the moments that matter.
          </p>
          <div className="flex flex-wrap gap-3 mt-8">
            <Button size="lg" asChild>
              <Link href="/record">
                {profile ? "Create a story" : "Start a story"}
                <ArrowRight aria-hidden className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href={profile ? "/library" : "#story-example"}>
                {profile ? "Open your archive" : "Explore an example"}
              </a>
            </Button>
          </div>
          <p className="flex items-center gap-2 mt-5 text-sm text-muted-foreground">
            <Lock aria-hidden className="size-3.5" />
            Private by default. No wallet needed.
          </p>
        </div>
        <StoryPreview />
      </section>
      {profile && (
        <nav
          aria-label="Your workspace shortcuts"
          className="flex flex-wrap gap-x-8 gap-y-3 border-y py-5"
        >
          {[
            ["Your archive", "/library"],
            ["Your tracker", "/tracker"],
            ["Your profile", "/profile"],
          ].map(([name, href]) => (
            <Link
              key={href}
              href={href}
              className="inline-flex min-h-11 items-center gap-2 text-sm hover:underline"
            >
              {name}
              <ArrowRight aria-hidden className="size-3" />
            </Link>
          ))}
        </nav>
      )}
      <section id="how-it-works" className="scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 border-b pb-7">
          <div>
            <p className="eyebrow">A small practice. A growing archive.</p>
            <h2 className="font-display text-3xl sm:text-4xl mt-3">
              Start wherever you are.
            </h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
            You don’t need a perfect beginning.
            <br />
            Just a moment you want to keep.
          </p>
        </div>
        <div className="grid md:grid-cols-3 gap-8 pt-8">
          {[
            {
              icon: Mic,
              n: "01",
              title: "Tell it your way",
              text: "Write freely or record a monologue. With transcription available, turn your voice into text you can review.",
            },
            {
              icon: MessageCircle,
              n: "02",
              title: "Find a thread",
              text: "Prefer a conversation? Begin a guided interview, then request one AI question at a time when AI assistance is available.",
            },
            {
              icon: BookOpen,
              n: "03",
              title: "Make it yours",
              text: "Edit, give it a title, and save it to your private archive. Publishing is a separate choice you control.",
            },
          ].map((step) => (
            <div key={step.n} className="space-y-4">
              <div className="flex items-center justify-between">
                <step.icon aria-hidden className="size-6 text-primary" />
                <span className="text-xs text-muted-foreground">{step.n}</span>
              </div>
              <h3 className="font-display text-2xl">{step.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground max-w-sm">
                {step.text}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl bg-secondary px-6 py-10 sm:p-12 grid md:grid-cols-[1fr_1.6fr] gap-8">
        <p className="eyebrow">A note on keeping things private</p>
        <div>
          <h2 className="font-display text-3xl">
            Your story. Your choice of audience.
          </h2>
          <p className="mt-4 text-muted-foreground leading-relaxed">
            Stories start private. You choose what to publish. Optional AI
            features send the text or audio needed for that request to a
            configured provider. Local Vault offers an encrypted copy on your
            device.
          </p>
          <Link
            href="/privacy"
            className="inline-flex min-h-11 items-center gap-2 text-sm underline underline-offset-4 mt-3"
          >
            Read how your data is handled
            <ArrowRight aria-hidden className="size-4" />
          </Link>
        </div>
      </section>
      <section className="max-w-3xl">
        <p className="eyebrow">A few things you might wonder</p>
        {[
          [
            "Do I need a crypto wallet?",
            "No. Continue with Google, complete your profile, and start writing. A wallet is optional.",
          ],
          [
            "Can I write without using AI?",
            "Yes. Write, edit and save a story directly. Transcription and AI follow-up questions depend on service availability and usage limits.",
          ],
          [
            "Is onchain verification available?",
            "Onchain verification is coming soon. Testnet experiments are not proof that a production story is verified.",
          ],
        ].map(([question, answer]) => (
          <details key={question} className="group border-b py-5">
            <summary className="cursor-pointer min-h-11 flex items-center justify-between gap-4 font-medium">
              {question}
              <span
                aria-hidden
                className="text-xl text-primary group-open:rotate-45 transition-transform"
              >
                +
              </span>
            </summary>
            <p className="pt-3 leading-relaxed text-sm text-muted-foreground">
              {answer}
            </p>
          </details>
        ))}
      </section>
      <MobileWaitlist />
    </div>
  );
}
