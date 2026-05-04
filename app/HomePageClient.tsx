"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useApp } from "../components/Provider";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Mic,
  BookOpen,
  Users,
  Brain,
  Quote,
  ArrowRight,
  Lock,
  ShieldCheck,
  EyeOff,
  Fingerprint,
  BotOff,
  ServerOff,
  Heart,
  Mail,
  Check,
  Lightbulb,
  Sparkles,
  Crown,
  ChevronDown,
  ChevronUp,
  Zap,
} from "lucide-react";

// ============================================================
// FEATURES — reframed as human benefits, not tech specs
// ============================================================
const features = [
  {
    icon: Mic,
    title: "Just talk",
    description:
      "Hit record and speak. About your day, a realization, a memory. AI transcribes perfectly. No typing required.",
  },
  {
    icon: Brain,
    title: "See your patterns",
    description:
      "AI finds the themes, emotions, and arcs across your stories. The patterns you couldn't see alone — with advice to grow.",
  },
  {
    icon: Lock,
    title: "Yours forever",
    description:
      "Your stories are encrypted and stored permanently. No platform shutdown, no acquisition, no server failure can touch them.",
  },
  {
    icon: BookOpen,
    title: "Curate your story",
    description:
      "Compile entries into collections — a year of growth, a chapter of your life. Keep them private or share on your terms.",
  },
  {
    icon: Users,
    title: "Real stories, real people",
    description:
      "Read and share authentic human experiences. No algorithms, no feeds — just a library of real voices.",
  },
  {
    icon: Heart,
    title: "Your story has value",
    description:
      "The community recognizes meaningful stories. Earn recognition for the experiences that resonate.",
  },
];

// ============================================================
// "WHY NOW" — the cultural moment that makes eStories necessary
// ============================================================
const whyNowCards = [
  {
    icon: BotOff,
    stat: "74%",
    statLabel: "of new web content is AI-generated",
    description:
      "The internet is flooding with synthetic content. Your authentic voice — the hesitations, the emotion, the unscripted truth — is becoming the rarest signal online.",
  },
  {
    icon: ServerOff,
    stat: "100%",
    statLabel: "of storytelling apps store your data on their servers",
    description:
      "Your most private thoughts live on infrastructure you don't control. If they get acquired, shut down, or breached — your stories go with them.",
  },
  {
    icon: Fingerprint,
    stat: "51%",
    statLabel: "of web traffic is now bots",
    description:
      "In a world where half the internet isn't even human, your voice, your story — recorded, timestamped, irreplaceably yours — is proof that you were here.",
  },
];

// ============================================================
// HOW IT WORKS — 3 steps, not 4. Simpler.
// ============================================================
const steps = [
  {
    step: 1,
    icon: Mic,
    title: "Talk",
    description:
      "Hit record and speak. About your day, a realization, whatever's on your mind. No prompts needed.",
  },
  {
    step: 2,
    icon: Lightbulb,
    title: "Understand",
    description:
      "AI extracts themes, emotions, and patterns across your entries. See the arcs of your life over time.",
  },
  {
    step: 3,
    icon: ShieldCheck,
    title: "Own",
    description:
      "Your stories are encrypted and stored permanently. No platform can delete them. No company can sell them. They're yours.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-base font-medium text-foreground pr-4">
          {question}
        </span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.2 }}
          className="pb-5"
        >
          <p className="text-sm text-muted-foreground leading-relaxed">
            {answer}
          </p>
        </motion.div>
      )}
    </div>
  );
}

export default function HomePage() {
  const { user, isConnected } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  // Pre-launch: handle waitlist email capture
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setWaitlistLoading(true);
    setWaitlistError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (res.status === 400) {
          setWaitlistError(data?.error || "Please enter a valid email.");
        } else if (res.status === 429) {
          setWaitlistError("Too many requests. Please try again later.");
        } else {
          setWaitlistError("Something went wrong. Please try again.");
        }
        return;
      }

      setWaitlistSubmitted(true);
      setEmail("");
    } catch {
      setWaitlistError("Network error. Please check your connection.");
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <div className="space-y-24 md:space-y-32">
      {/* ============================================================
          HERO SECTION
          Job: Stop the scroll. Create emotional resonance. Get the click.
          ============================================================ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="text-center space-y-8 pt-8 md:pt-20"
      >
        <div className="space-y-6 max-w-3xl mx-auto">
          {/* Trust signals — benefit-oriented, not tech-oriented */}
          <div className="flex flex-wrap justify-center gap-3">
            <span className="badge-subtle inline-flex items-center gap-2">
              <Lock className="w-3.5 h-3.5" />
              Private by default
            </span>
            <span className="badge-subtle inline-flex items-center gap-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              Your data, your ownership
            </span>
          </div>

          {/* Main heading — speak, see patterns, own legacy */}
          <h1 className="heading-display-lg text-4xl md:text-5xl lg:text-5xl leading-[1.1]">
            <span className="text-foreground">Speak your story, see your patterns,</span>
            <br />
            <span className="text-gradient-cosmic">own and preserve your legacy.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Your voice, your meaning, permanently yours. Write about anything:
            personal stories, history, culture, geopolitics. AI helps you become
            a better storyteller.
          </p>
        </div>

        {/* CTAs — Google OAuth primary, Explore secondary */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
          {isConnected ? (
            <Button
              size="lg"
              onClick={() => router.push("/record")}
              className="bg-linear-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] hover:from-[hsl(var(--memory-500))] hover:to-[hsl(var(--insight-500))] text-white text-lg px-8 h-12"
            >
              <Mic className="w-5 h-5 mr-2" />
              Record a Story
            </Button>
          ) : (
            <Button
              size="lg"
              onClick={() => router.push("/record")}
              className="bg-linear-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] hover:from-[hsl(var(--memory-500))] hover:to-[hsl(var(--insight-500))] text-white text-lg px-8 h-12"
            >
              Start Writing — Free
            </Button>
          )}

          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              document
                .getElementById("how-it-works")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-lg px-8 h-12 border-[hsl(var(--memory-500)/0.2)] hover:border-[hsl(var(--memory-500)/0.4)] hover:bg-[hsl(var(--memory-500)/0.05)]"
          >
            See How It Works
          </Button>
        </div>
      </motion.section>

      {/* ============================================================
          WELCOME BACK — Only shown when connected (kept from original)
          ============================================================ */}
      {isConnected && user && (
        <section>
          <Card className="card-canonical border-[hsl(var(--story-500)/0.3)] overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ y: 0 }}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-14 h-14 rounded-full bg-linear-to-br from-[hsl(var(--story-500)/0.12)] to-[hsl(var(--memory-500)/0.08)] flex items-center justify-center"
                  >
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      className="opacity-95"
                    >
                      <path
                        d="M2 12c3-6 9-6 14-2 4 3 6 8 6 8"
                        stroke="currentColor"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-[hsl(var(--story-500))]"
                      />
                      <circle
                        cx="6"
                        cy="15"
                        r="1.5"
                        fill="currentColor"
                        className="text-[hsl(var(--memory-500))]"
                      />
                    </svg>
                  </motion.div>

                  <div>
                    <CardTitle className="heading-section text-2xl text-gradient-story">
                      Welcome back
                    </CardTitle>
                    <CardDescription>
                      Ready to capture your next story?
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-sm text-muted-foreground text-right">
                    <div className="font-medium text-foreground">
                      {user.addressDisplay}
                    </div>
                    <div>
                      {user.storyTokens} story tokens • {user.badges.length}{" "}
                      badges
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                <div className="md:col-span-2 flex flex-col sm:flex-row gap-3">
                  <Button
                    onClick={() => router.push("/record")}
                    className="btn-solid-memory flex-1 flex items-center justify-center"
                    size="lg"
                  >
                    <Mic className="w-4 h-4 mr-2" />
                    Record New Story
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => router.push("/library")}
                    className="flex-1"
                    size="lg"
                  >
                    <BookOpen className="w-4 h-4 mr-2" />
                    View Library
                  </Button>
                </div>

                <div className="md:col-span-1">
                  <div className="rounded-lg bg-[hsl(var(--memory-500)/0.03)] p-3 text-sm">
                    <div className="font-medium text-foreground">
                      Quick Insights
                    </div>
                    <div className="text-muted-foreground text-xs mt-2">
                      We analyzed your recent entries and found emerging themes
                      — try recording a reflection.
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push("/insights")}
                      >
                        <Brain className="w-4 h-4 mr-2" />
                        View Insights
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      )}

      {/* ============================================================
          HOW IT WORKS — 3 steps, clarity over cleverness
          ============================================================ */}
      <section id="how-it-works" className="space-y-12 scroll-mt-20">
        <div className="text-center space-y-4">
          <h2 className="heading-section text-3xl md:text-4xl text-foreground">
            How <span className="text-gradient-insight">eStories</span> works
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Three steps. No typing required.
          </p>
        </div>

        <div className="relative">
          {/* Connection line */}
          <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-px bg-[hsl(var(--memory-500)/0.2)]" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {steps.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="relative inline-flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-[hsl(var(--void-surface))] border border-[hsl(var(--memory-500)/0.3)] flex items-center justify-center text-sm font-medium text-[hsl(var(--memory-500))] mb-4">
                      {item.step}
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-[hsl(var(--memory-500)/0.1)] flex items-center justify-center mb-4">
                      <Icon className="w-6 h-6 text-[hsl(var(--memory-500))]" />
                    </div>
                    <h3 className="font-semibold text-foreground text-lg mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-[250px]">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============================================================
          FEATURES — human benefits, not tech specs
          ============================================================ */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="heading-section text-3xl md:text-4xl text-foreground">
            Built for people who{" "}
            <span className="text-gradient-memory">think deeply</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            A storytelling experience designed for reflection and craft, not engagement
            metrics. Write personal stories, history, culture, geopolitics — anything that matters to you.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.title}
                className="card-elevated hover-shadow-subtle"
              >
                <CardHeader>
                  <div className="w-10 h-10 rounded-lg bg-[hsl(var(--memory-500)/0.1)] flex items-center justify-center mb-3">
                    <Icon className="w-5 h-5 text-[hsl(var(--memory-500))]" />
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          WHY NOW — the cultural moment (NEW section)
          ============================================================ */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="heading-section text-3xl md:text-4xl text-foreground">
            Why your voice matters{" "}
            <span className="text-gradient-story">more than ever</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {whyNowCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.statLabel}
                className="card-elevated hover-shadow-subtle"
              >
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[hsl(var(--story-500)/0.1)] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[hsl(var(--story-500))]" />
                    </div>
                    <div>
                      <span className="text-2xl font-semibold text-foreground">
                        {card.stat}
                      </span>
                      <span className="text-sm text-muted-foreground ml-1.5">
                        {card.statLabel}
                      </span>
                    </div>
                  </div>
                  <p className="text-muted-foreground leading-relaxed text-[15px]">
                    {card.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          TRUST — Founder promise + guarantees (replaces fake testimonials)
          ============================================================ */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="heading-section text-3xl md:text-4xl text-foreground">
            The <span className="text-gradient-memory">eStories</span> promise
          </h2>
        </div>

        {/* Founder quote */}
        <Card className="card-elevated max-w-2xl mx-auto">
          <CardContent className="pt-6 space-y-4">
            <Quote className="w-6 h-6 text-[hsl(var(--memory-500)/0.3)]" />
            <p className="text-muted-foreground italic leading-relaxed text-lg">
              &ldquo;I built eStories because I needed it — a tool with less
              friction that could also help me improve over time. Other platforms
              force you to type, which makes storytelling and writing harder. My most
              important thoughts ended up trapped on services I didn&apos;t control.
              Your stories and your voice shouldn&apos;t belong to a company — they
              should belong to you. We are living through one of the most important
              periods in human history. People should write more, care more about
              their stories, and take ownership of how their histories are
              written.&rdquo;
            </p>
            <div className="flex items-center gap-3 pt-4 border-t border-[hsl(var(--memory-500)/0.1)]">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--memory-500)/0.15)] flex items-center justify-center text-[hsl(var(--memory-500))] font-medium text-sm">
                RA
              </div>
              <div>
                <div className="font-medium text-foreground">Remi</div>
                <div className="text-sm text-muted-foreground">
                  Founder, eStories
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trust guarantees */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto">
          {[
            {
              icon: EyeOff,
              title: "We don't read your stories",
              description:
                "Your entries are encrypted. We couldn't read them even if we wanted to.",
            },
            {
              icon: Lock,
              title: "No ads, no data mining",
              description:
                "We don't sell your data. We don't profile you. We don't run ads. Ever.",
            },
            {
              icon: ShieldCheck,
              title: "You leave, you keep everything",
              description:
                "If you ever leave eStories, your stories go with you. They're your files.",
            },
          ].map((guarantee) => {
            const Icon = guarantee.icon;
            return (
              <div key={guarantee.title} className="text-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-[hsl(var(--memory-500)/0.1)] flex items-center justify-center mx-auto">
                  <Icon className="w-6 h-6 text-[hsl(var(--memory-500))]" />
                </div>
                <h3 className="font-semibold text-foreground">
                  {guarantee.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {guarantee.description}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ============================================================
          PRICING — Simple, affordable plans
          ============================================================ */}
      <section id="pricing" className="space-y-12 scroll-mt-20">
        <div className="text-center space-y-4">
          <h2 className="heading-section text-3xl md:text-4xl text-foreground">
            Simple,{" "}
            <span className="text-gradient-cosmic">affordable</span> pricing
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Start writing for free. Upgrade when you want AI craft feedback,
            story collections, or creator tools.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="card-elevated flex flex-col">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-[hsl(var(--memory-500)/0.1)] rounded-full flex items-center justify-center">
                <Mic className="w-6 h-6 text-[hsl(var(--memory-500))]" />
              </div>
              <CardTitle>Free</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$0</span>
                <span className="text-muted-foreground ml-1">forever</span>
              </div>
              <CardDescription className="mt-2">
                Start your storytelling journey.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2.5 flex-1 text-sm">
                {[
                  "Unlimited story recording & writing",
                  "AI transcription (voice-to-text)",
                  "AI text enhancement",
                  "10 AI story analyses per month",
                  "Encrypted local vault",
                  "Public story feed access",
                  "Basic story insights",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full mt-6"
                onClick={() => router.push("/record")}
              >
                Get Started Free
              </Button>
            </CardContent>
          </Card>

          {/* Storyteller Plan */}
          <Card className="relative flex flex-col border-2 border-[hsl(var(--story-500))] shadow-lg shadow-[hsl(var(--story-500)/0.1)]">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-[hsl(var(--story-500))] to-[hsl(var(--insight-500))] text-white text-xs font-medium px-3 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-[hsl(var(--story-500)/0.1)] rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[hsl(var(--story-500))]" />
              </div>
              <CardTitle>Storyteller</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$2.99</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <CardDescription className="mt-2">
                AI-powered craft improvement.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2.5 flex-1 text-sm">
                {[
                  "Everything in Free, plus:",
                  "Unlimited AI story analyses",
                  "Actionable AI advice per story",
                  "Story collections & continuations",
                  "Weekly AI reflections",
                  "Advanced theme & pattern tracking",
                  "Storytelling progress reports",
                  "Priority CRE verification",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full mt-6 bg-gradient-to-r from-[hsl(var(--story-500))] to-[hsl(var(--insight-500))] hover:from-[hsl(var(--story-600))] hover:to-[hsl(var(--insight-600))] text-white"
                onClick={() => router.push("/pricing")}
              >
                Start Writing Better
              </Button>
            </CardContent>
          </Card>

          {/* Creator Plan */}
          <Card className="card-elevated flex flex-col">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-[hsl(var(--insight-500)/0.1)] rounded-full flex items-center justify-center">
                <Crown className="w-6 h-6 text-[hsl(var(--insight-500))]" />
              </div>
              <CardTitle>Creator</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">$7.99</span>
                <span className="text-muted-foreground ml-1">/month</span>
              </div>
              <CardDescription className="mt-2">
                Publish, monetize, build an audience.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <ul className="space-y-2.5 flex-1 text-sm">
                {[
                  "Everything in Storyteller, plus:",
                  "Unlimited public publishing",
                  "Custom paywall pricing",
                  "NFT book minting (no extra fee)",
                  "Creator analytics dashboard",
                  "Tip collection from readers",
                  "Custom author profile page",
                  "Priority support",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full mt-6"
                onClick={() => router.push("/pricing")}
              >
                Become a Creator
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================
          FAQ — Common questions answered
          ============================================================ */}
      <section id="faq" className="space-y-12 scroll-mt-20">
        <div className="text-center space-y-4">
          <h2 className="heading-section text-3xl md:text-4xl text-foreground">
            Frequently asked{" "}
            <span className="text-gradient-insight">questions</span>
          </h2>
        </div>

        <div className="max-w-3xl mx-auto">
          <Card className="card-elevated">
            <CardContent className="py-2">
              {[
                {
                  q: "What can I write about on eStories?",
                  a: "Anything you're passionate about! Personal journals, historical narratives, geopolitical analysis, cultural stories, creative non-fiction, memoirs, travel writing — the platform is for all forms of storytelling. Private stories stay encrypted; public stories can be shared with the community.",
                },
                {
                  q: "How does the AI help me become a better writer?",
                  a: "Every story gets analyzed for narrative coherence, emotional depth, thematic consistency, and significance. You get a brief insight and actionable advice on how to improve. Over time, track your progress as your scores improve. It's like a writing coach that learns your patterns.",
                },
                {
                  q: "Is my data private and secure?",
                  a: "Yes. Private stories are encrypted with AES-256-GCM in your browser before storage — we literally cannot read them. Your encryption key is derived from your PIN and never leaves your device. For public stories, Chainlink CRE provides verifiable AI analysis without exposing raw data on-chain.",
                },
                {
                  q: "Do I need a crypto wallet?",
                  a: "No! Sign up with Google or email. A crypto wallet is optional — it will unlock future Web3 features like tipping, paywalls, NFT book minting, and on-chain provenance when we launch on mainnet. Add one anytime from your profile.",
                },
                {
                  q: "What are $STORY tokens?",
                  a: "$STORY is an ERC-20 token on Base (Ethereum L2) being developed for the creator economy — tipping, paywalled stories, and NFT minting. It is currently on testnet and will launch on mainnet once the platform reaches critical adoption. You don't need tokens to use eStories today.",
                },
                {
                  q: "What is CRE-verified quality?",
                  a: "Chainlink CRE runs AI analysis across multiple independent nodes inside encrypted enclaves. The nodes reach consensus and write a cryptographic proof on-chain. Quality ratings on paywalled stories are verifiable and tamper-proof — readers can trust the score before purchasing.",
                },
                {
                  q: "How do story collections work?",
                  a: "Group related stories into collections — like a series on history or a year of personal growth. Continue existing stories as linked threads. In the future, collections will be mintable as NFT books on the blockchain.",
                },
                {
                  q: "Can I cancel anytime?",
                  a: "Yes. Upgrade, downgrade, or cancel at any time. Your stories are always yours — they stay in your encrypted vault regardless of your plan.",
                },
                {
                  q: "What happens if eStories shuts down?",
                  a: "Your private stories live in your browser's encrypted local vault — on your device, not our servers. Public stories have permanent blockchain provenance. Audio is on IPFS (decentralized). Your content survives independently.",
                },
              ].map((faq) => (
                <FAQItem key={faq.q} question={faq.q} answer={faq.a} />
              ))}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================
          FINAL CTA — Convert anyone who scrolled this far
          ============================================================ */}
      <section className="text-center space-y-8 py-16 px-6 bg-[hsl(var(--void-light))] dark:bg-[hsl(var(--void-medium))] rounded-2xl border border-[hsl(var(--memory-500)/0.1)]">
        <h2 className="heading-section text-3xl md:text-4xl text-foreground">
          Your story starts here
        </h2>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Free to start. Your voice. Your memories. Actually yours.
        </p>

        <div className="flex flex-col gap-6 items-center">
          {/* Primary: Start or Waitlist */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isConnected ? (
              <Button
                size="lg"
                onClick={() => router.push("/record")}
                className="bg-linear-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] hover:from-[hsl(var(--memory-500))] hover:to-[hsl(var(--insight-500))] text-white px-8 h-12"
              >
                <Mic className="w-5 h-5 mr-2" />
                Record a Story
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={() => router.push("/record")}
                className="bg-linear-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] hover:from-[hsl(var(--memory-500))] hover:to-[hsl(var(--insight-500))] text-white px-8 h-12"
              >
                <ArrowRight className="w-5 h-5 mr-2" />
                Start Writing — Free
              </Button>
            )}

            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push("/social")}
              className="px-8 h-12 border-[hsl(var(--memory-500)/0.2)] hover:border-[hsl(var(--memory-500)/0.4)] hover:bg-[hsl(var(--memory-500)/0.05)]"
            >
              <BookOpen className="w-5 h-5 mr-2" />
              Read Real Stories
            </Button>
          </div>

          {/* Email waitlist — pre-launch capture */}
          <div className="w-full max-w-md">
            <p className="text-sm text-muted-foreground mb-3">
              Want to be first when we launch the mobile app?
            </p>
            {waitlistSubmitted ? (
              <div className="flex items-center justify-center gap-2 text-[hsl(var(--growth-500))] py-3">
                <Check className="w-5 h-5" />
                <span className="font-medium">
                  You&apos;re on the list. We&apos;ll be in touch.
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <form onSubmit={handleWaitlistSubmit} className="flex gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={waitlistLoading}
                    className="flex-1 h-11 rounded-lg border border-[hsl(var(--memory-500)/0.2)] bg-[hsl(var(--void-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--memory-500)/0.3)] focus:border-transparent transition-all disabled:opacity-50"
                  />
                  <Button
                    type="submit"
                    variant="outline"
                    disabled={waitlistLoading}
                    className="h-11 px-5 border-[hsl(var(--memory-500)/0.3)] hover:bg-[hsl(var(--memory-500)/0.1)]"
                  >
                    {waitlistLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Joining...
                      </span>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Join Waitlist
                      </>
                    )}
                  </Button>
                </form>
                {waitlistError && (
                  <p className="text-sm text-red-500 text-center">
                    {waitlistError}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
