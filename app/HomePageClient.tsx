"use client";

import { useState, useId } from "react";
import Link from "next/link";
import { StoryScene } from "@/components/landing/StoryScene";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "../components/ui/button";
import { trackLead } from "@/lib/meta-pixel";
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
} from "lucide-react";

// ============================================================
// FEATURES — reframed as human benefits, not tech specs
// ============================================================
const features = [
  {
    icon: Mic,
    title: "Just talk",
    description:
      "Record a monologue or write freely. Prefer a conversation? Choose a guided interview. AI transcription and follow-up questions are available when AI assistance is enabled.",
  },
  {
    icon: Brain,
    title: "See your patterns",
    description:
      "When AI assistance is available, explore suggested themes, emotions and narrative feedback. Review its interpretations and decide what fits your experience.",
  },
  {
    icon: Lock,
    title: "Yours forever",
    description:
      "Save stories to your account. An optional Local Vault encrypts a copy on this device; export backups for safekeeping.",
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
      "Explore the community library, follow writers, and share the stories you choose to make public. Your private drafts stay separate.",
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
    stat: "Your",
    statLabel: "voice matters",
    description:
      "Your hesitations, emotion and personal perspective are part of the story. Start with your own words; use optional AI help without giving up editorial control.",
  },
  {
    icon: ServerOff,
    stat: "Your",
    statLabel: "memories deserve care",
    description:
      "Keep stories in your account and use the optional encrypted Local Vault for a device copy. Export a backup before clearing browser storage or changing devices.",
  },
  {
    icon: Fingerprint,
    stat: "Your",
    statLabel: "perspective is unique",
    description:
      "Everyday moments, family histories and turning points deserve a place alongside the big events. Leave a record in your own words, for yourself or the audience you choose.",
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
      "Review your words, edit your story, and explore optional AI feedback when available. AI suggestions are interpretations you can accept or ignore.",
  },
  {
    step: 3,
    icon: ShieldCheck,
    title: "Own",
    description:
      "Keep private stories in your account and choose what to publish. Public IPFS publication can be permanent.",
  },
];

function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const panelId = useId();
  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        aria-expanded={isOpen}
        aria-controls={panelId}
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
          id={panelId}
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

export default function HomePage({
  publicWelcome = false,
}: {
  publicWelcome?: boolean;
}) {
  const { profile } = useAuth();
  const isConnected = Boolean(profile);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [waitlistError, setWaitlistError] = useState("");

  // Pre-launch: handle waitlist email capture
  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed || waitlistLoading) return;

    setWaitlistLoading(true);
    setWaitlistError("");

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        credentials: "same-origin",
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
      trackLead({
        content_name: "Mobile App Waitlist",
        content_category: "pre_launch",
      });
    } catch {
      setWaitlistError("Network error. Please check your connection.");
    } finally {
      setWaitlistLoading(false);
    }
  };

  return (
    <div className="landing-page space-y-24 md:space-y-32">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="min-w-0">
          <p className="landing-kicker">
            A LIFE IS MADE OF STORIES. KEEP YOURS.
          </p>
          <h1 id="landing-title">
            Speak your story,
            <br />
            <span>see your patterns,</span>
            <br />
            <em>own and preserve your legacy.</em>
          </h1>
          <p className="landing-intro">
            Your voice, your meaning, your story. Write about anything: personal
            stories, history, culture, geopolitics. Record a monologue, write
            freely, or build a story through a guided interview.
          </p>
          <div className="landing-actions">
            <Button
              asChild
              size="lg"
              className="bg-linear-to-r from-[hsl(var(--memory-600))] to-[hsl(var(--insight-600))] text-white"
            >
              <Link href="/record">
                {isConnected ? "Record a Story" : "Start Writing — Free"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="#how-it-works">See How It Works</a>
            </Button>
          </div>
          <div className="landing-assurance">
            <span>
              <Lock size={13} />
              Private by default
            </span>
            <span>
              <ShieldCheck size={13} />
              Your data, your ownership
            </span>
          </div>
        </div>
        <StoryScene />
      </section>
      {publicWelcome && profile && (
        <section className="rounded-xl border bg-card p-6 sm:p-8">
          <h2 className="text-2xl font-semibold">
            Welcome back{profile.name ? ", " + profile.name : ""}
          </h2>
          <p className="mt-2 text-muted-foreground">
            Ready to capture your next story?
          </p>
          <nav
            aria-label="Your workspace shortcuts"
            className="mt-5 flex flex-wrap gap-3"
          >
            <Button asChild>
              <Link href="/record">Record a Story</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/library">Open your archive</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/tracker">Your tracker</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/profile">Your profile</Link>
            </Button>
          </nav>
        </section>
      )}

      <section id="how-it-works" className="scroll-mt-24">
        <p className="landing-chapter-rule">01 / FROM A MOMENT TO A CHAPTER</p>
        <div className="landing-section-heading mt-6">
          <h2>
            How <span className="text-gradient-insight">eStories</span> works
          </h2>
          <p>Speak or write. Reflect. Keep what matters.</p>
        </div>
        <div className="landing-steps">
          {steps.map((item) => {
            const Icon = item.icon;
            return (
              <article className="landing-step" key={item.step}>
                <div className="landing-step-index">
                  <span>0{item.step}</span>
                  <Icon size={23} strokeWidth={1.4} />
                </div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <div className="landing-step-art" aria-hidden="true">
                  {
                    [
                      "?I want to remember this.?",
                      "A thought becomes a thread.",
                      "A chapter, on your terms.",
                    ][item.step - 1]
                  }
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section>
        <p className="landing-chapter-rule">
          02 / ROOM FOR YOUR WHOLE PERSPECTIVE
        </p>
        <div className="landing-section-heading mt-6">
          <h2>
            Built for people who{" "}
            <span className="text-gradient-memory">think deeply</span>
          </h2>
          <p>
            A storytelling experience designed for reflection and craft, not
            engagement metrics. Write personal stories, history, culture,
            geopolitics — anything that matters to you.
          </p>
        </div>
        <div className="landing-feature-list">
          {features.map((feature, index) => (
            <article className="landing-feature" key={feature.title}>
              <span aria-hidden="true">0{index + 1}</span>
              <div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="landing-reasons">
        <div className="landing-section-heading">
          <h2>
            Why your voice matters{" "}
            <span className="text-gradient-story">more than ever</span>
          </h2>
          <p>
            The details only you can tell. The moments only you remember. A
            record in your own words.
          </p>
        </div>
        <div className="landing-reason-grid">
          {whyNowCards.map((card) => (
            <article key={card.statLabel}>
              <h3>
                <em>{card.stat}</em> {card.statLabel}
              </h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ============================================================
          TRUST — Founder promise + guarantees (replaces fake testimonials)
          ============================================================ */}
      <section className="space-y-12">
        <div className="text-center space-y-4">
          <h2 className="font-semibold tracking-tight text-3xl md:text-4xl text-foreground">
            The <span className="text-gradient-memory">eStories</span> promise
          </h2>
        </div>

        {/* Founder quote */}
        <Card className="card-elevated max-w-2xl mx-auto">
          <CardContent className="pt-6 space-y-4">
            <Quote className="w-6 h-6 text-[hsl(var(--memory-500)/0.3)]" />
            <p className="text-muted-foreground italic leading-relaxed text-lg">
              &ldquo;I built eStories because I needed it — a tool with less
              friction that could also help me improve over time. Other
              platforms force you to type, which makes storytelling and writing
              harder. My most important thoughts ended up trapped on services I
              didn&apos;t control. Your stories and your voice shouldn&apos;t
              belong to a company — they should belong to you. We are living
              through one of the most important periods in human history. People
              should write more, care more about their stories, and take
              ownership of how their histories are written.&rdquo;
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
              title: "Private by default",
              description:
                "Private entries are stored in your account. The optional Local Vault encrypts a separate copy on your device.",
            },
            {
              icon: Lock,
              title: "Control optional tracking",
              description:
                "Choose essential cookies only or allow optional analytics. Change that choice anytime from Cookie preferences. Read our privacy policy for the full details.",
            },
            {
              icon: ShieldCheck,
              title: "Keep a copy you control",
              description:
                "The optional Local Vault stores an encrypted copy on this device. Export a backup for safekeeping; account stories still depend on our service.",
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
          <h2 className="font-semibold tracking-tight text-3xl md:text-4xl text-foreground">
            Simple, <span className="text-gradient-cosmic">affordable</span>{" "}
            pricing
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            Start with a free account. Compare the plans for writing, organizing
            your archive and sharing your work.
          </p>
        </div>

        <p className="mx-auto max-w-2xl text-center text-sm text-muted-foreground">
          AI features are currently unavailable in production. Writing, editing
          and saving remain available. AI availability and usage limits apply to
          every plan; onchain verification is coming soon.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="card-elevated flex flex-col">
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-[hsl(var(--memory-500)/0.1)] rounded-full flex items-center justify-center">
                <Mic className="w-6 h-6 text-[hsl(var(--memory-500))]" />
              </div>
              <CardTitle role="heading" aria-level={3}>
                Free
              </CardTitle>
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
                  "Story recording & writing",
                  "Optional AI transcription (when enabled)",
                  "Optional AI text enhancement",
                  "AI story analyses within usage limits",
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
                For regular writers
              </span>
            </div>
            <CardHeader className="text-center pb-4">
              <div className="w-12 h-12 mx-auto mb-3 bg-[hsl(var(--story-500)/0.1)] rounded-full flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[hsl(var(--story-500))]" />
              </div>
              <CardTitle role="heading" aria-level={3}>
                Storyteller
              </CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">
                  $2.99
                </span>
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
                  "AI story analyses within usage limits",
                  "Actionable AI advice per story",
                  "Story collections & continuations",
                  "Weekly AI reflections",
                  "Advanced theme & pattern tracking",
                  "Storytelling progress reports",
                  "On-chain verification — Coming soon",
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
              <CardTitle role="heading" aria-level={3}>
                Creator
              </CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-bold text-foreground">
                  $7.99
                </span>
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
                  "Public story publishing",
                  "Paywall tools where available",
                  "NFT book minting — Coming soon",
                  "Creator analytics dashboard",
                  "Reader tipping where available",
                  "Author profile page",
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
          <h2 className="font-semibold tracking-tight text-3xl md:text-4xl text-foreground">
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
                  a: "Anything you're passionate about! Personal journals, historical narratives, geopolitical analysis, cultural stories, creative non-fiction, memoirs, travel writing — the platform is for all forms of storytelling. Private stories stay in your account; public stories can be shared with the community.",
                },
                {
                  q: "How does the AI help me become a better writer?",
                  a: "When AI assistance is enabled, request transcription, text enhancement or a guided interview question. Story analysis can suggest themes and narrative feedback. Suggestions are interpretations, not verified facts; service availability and usage limits apply. You can always write, edit and save without AI.",
                },
                {
                  q: "Is my data private and secure?",
                  a: "Private stories are stored in your account. The optional Local Vault encrypts a separate copy on this device with AES-256-GCM. AI features send input to the configured AI provider. Public IPFS publication can be permanent. On-chain verification is coming soon; testnet verification is parked.",
                },
                {
                  q: "Do I need a crypto wallet?",
                  a: "No! Sign up with Google. A crypto wallet is optional — it will unlock future Web3 features like tipping, paywalls, NFT book minting, and on-chain provenance when we launch on mainnet. Add one anytime from your profile.",
                },
                {
                  q: "What are $STORY tokens?",
                  a: "$STORY is an ERC-20 token on Base (Ethereum L2) being developed for the creator economy — tipping, paywalled stories, and NFT minting. It is currently on testnet and will launch on mainnet once the platform reaches critical adoption. You don't need tokens to use eStories today.",
                },
                {
                  q: "Is on-chain verification available?",
                  a: "On-chain verification is coming soon. Testnet CRE verification is parked while its proof and delivery guarantees are reviewed. Current AI insights are interpretations, not on-chain attestations.",
                },
                {
                  q: "How do story collections work?",
                  a: "Group related stories into collections — like a series on history or a year of personal growth. Continue existing stories as linked threads. In the future, collections will be mintable as NFT books on the blockchain.",
                },
                {
                  q: "Can I cancel anytime?",
                  a: "Yes. Upgrade, downgrade, or cancel at any time. Your existing stories remain available in your account regardless of your plan.",
                },
                {
                  q: "What happens if eStories shuts down?",
                  a: "Stories in your account depend on our service. If enabled, the Local Vault keeps an encrypted device copy; export a backup before clearing browser storage. Explicitly published IPFS content may remain available independently. On-chain verification is coming soon.",
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
        <h2 className="font-semibold tracking-tight text-3xl md:text-4xl text-foreground">
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
                <form
                  onSubmit={handleWaitlistSubmit}
                  className="flex flex-col sm:flex-row gap-2"
                >
                  <input
                    type="email"
                    aria-label="Email address for mobile launch updates"
                    autoComplete="email"
                    maxLength={254}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    disabled={waitlistLoading}
                    className="min-w-0 flex-1 h-11 rounded-lg border border-[hsl(var(--memory-500)/0.2)] bg-[hsl(var(--void-surface))] px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--memory-500)/0.3)] focus:border-transparent transition-all disabled:opacity-50"
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
