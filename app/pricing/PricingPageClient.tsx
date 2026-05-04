"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Check,
  Mic,
  Brain,
  Shield,
  Zap,
  ChevronDown,
  ChevronUp,
  Crown,
  Sparkles,
  Lock,
  Copy,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { useBackgroundMode } from "@/contexts/BackgroundContext";
import { useSubscription } from "@/app/hooks/useSubscription";
import { useAuth } from "@/components/AuthProvider";

// ============================================================================
// Pricing Data
// ============================================================================

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Start your storytelling journey. No credit card required.",
    icon: Mic,
    highlight: false,
    features: [
      "Unlimited story recording & writing",
      "AI transcription (voice-to-text)",
      "AI text enhancement",
      "10 AI story analyses per month",
      "Encrypted local vault (PIN-protected)",
      "Public story feed access",
      "Like & follow other storytellers",
      "Basic story insights (themes, emotions)",
    ],
    limitations: [
      "10 AI analyses/month",
      "No actionable AI advice",
      "No story collections",
    ],
    cta: "Get Started Free",
    href: "/record",
  },
  {
    name: "Storyteller",
    price: "$2.99",
    period: "/month",
    description:
      "For passionate writers who want AI-powered craft improvement.",
    icon: Sparkles,
    highlight: true,
    badge: "Most Popular",
    features: [
      "Everything in Free, plus:",
      "Unlimited AI story analyses",
      "Actionable AI advice per story",
      "Story collections & continuations",
      "Storytelling craft feedback",
      "Weekly AI reflections",
      "Priority CRE verification",
      "Advanced theme & pattern tracking",
      "Monthly storytelling progress report",
    ],
    limitations: [],
    cta: "Start Writing Better",
    href: "/record",
  },
  {
    name: "Creator",
    price: "$7.99",
    period: "/month",
    description:
      "For creators who publish, monetize, and build an audience.",
    icon: Crown,
    highlight: false,
    features: [
      "Everything in Storyteller, plus:",
      "Unlimited public story publishing",
      "Custom paywall pricing per story (coming soon)",
      "NFT book minting — no extra fee (coming soon)",
      "Creator analytics dashboard",
      "Tip collection from readers (coming soon)",
      "Priority support",
      "Custom author profile page",
      "Early access to new features",
    ],
    limitations: [],
    cta: "Become a Creator",
    href: "/record",
  },
];

// ============================================================================
// FAQ Data
// ============================================================================

const faqs = [
  {
    question: "What can I write about on eStories?",
    answer:
      "Anything you're passionate about! eStories is a storytelling platform, not just a journal. Write personal reflections, historical narratives, geopolitical analysis, cultural stories, creative non-fiction, memoirs, travel writing, or anything else. Private stories stay encrypted in your vault; public stories can be shared with the community.",
  },
  {
    question: "How does the AI analysis help me become a better writer?",
    answer:
      "Every story you write gets analyzed for narrative coherence, emotional depth, thematic consistency, and significance. The AI provides a brief insight about your story's meaning and actionable advice on how to improve. Over time, you can track your storytelling progress as your scores improve. Think of it as a writing coach that learns your patterns.",
  },
  {
    question: "Is my data private and secure?",
    answer:
      "Yes. Private stories are encrypted with AES-256-GCM in your browser before storage — we literally cannot read them. Your encryption key is derived from your PIN and never leaves your device. For public stories, Chainlink CRE provides verifiable AI analysis without exposing your raw data on-chain. Only cryptographic proofs go to the blockchain.",
  },
  {
    question: "Do I need a crypto wallet to use eStories?",
    answer:
      "No! You can sign up with Google OAuth or create an account with email. A crypto wallet is optional — it will unlock future Web3 features like tipping, paywalls, NFT book minting, and on-chain provenance when we launch on mainnet. You can add a wallet anytime from your profile settings.",
  },
  {
    question: "What are $STORY tokens used for?",
    answer:
      "$STORY is an ERC-20 token on Base (Ethereum L2) being developed for the creator economy — tipping, paywalled stories, and NFT minting. It is currently on testnet and will launch on mainnet once the platform reaches critical adoption. You don't need tokens to use eStories today.",
  },
  {
    question: "What is CRE-verified quality?",
    answer:
      "Chainlink CRE (Compute Runtime Environment) runs AI analysis across multiple independent nodes inside encrypted enclaves. The nodes reach consensus, and a cryptographic proof is written on-chain. This means quality ratings on paywalled stories are verifiable and tamper-proof — readers can trust the quality score before purchasing.",
  },
  {
    question: "Can I publish stories about history, politics, or culture?",
    answer:
      "Absolutely — that's a core use case. eStories is designed for all forms of storytelling. Historical essays, geopolitical analysis, and cultural narratives are especially well-suited for public publishing with paywalls. The on-chain provenance proves a human wrote the story at a specific time, which has archival and journalistic value.",
  },
  {
    question: "How do story collections work?",
    answer:
      "You can group related stories into collections — like a series on \"The History of West African Trade Routes\" or \"My Year Living Abroad.\" You can also continue an existing story, creating a linked narrative thread. In the future, collections will be mintable as NFT books on the blockchain.",
  },
  {
    question: "Can I switch plans or cancel anytime?",
    answer:
      "Yes. You can upgrade, downgrade, or cancel your plan at any time. If you cancel, you keep access until the end of your billing period. Your stories are always yours — they stay in your encrypted vault regardless of your plan.",
  },
  {
    question: "What happens to my stories if eStories shuts down?",
    answer:
      "Your private stories live in your browser's encrypted local vault — they exist on your device, not our servers. Public stories published on-chain have permanent blockchain provenance. Audio files are stored on IPFS (decentralized storage). eStories is designed so your content survives independent of the platform.",
  },
];

// ============================================================================
// Components
// ============================================================================

function FAQItem({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-5 text-left"
      >
        <span className="text-base font-medium text-gray-900 dark:text-white pr-4">
          {question}
        </span>
        {isOpen ? (
          <ChevronUp className="w-5 h-5 text-gray-400 flex-shrink-0" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
        )}
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className="pb-5"
        >
          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
            {answer}
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// Main Page
// ============================================================================

export default function PricingPageClient() {
  useBackgroundMode("home");
  const { profile } = useAuth();
  const { status: subStatus, paymentInfo, creatingPlan, verifying, subscribe, verifyPayment, clearPaymentInfo } = useSubscription();
  const [copied, setCopied] = useState(false);

  const handleSubscribe = async (planKey: string) => {
    if (!profile?.id) {
      toast.error("Please sign in to subscribe");
      return;
    }
    try {
      const result = await subscribe(planKey);
      if (result?.activated) {
        toast.success(result.message || "Subscription activated!");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create payment");
    }
  };

  const copyAddress = () => {
    if (paymentInfo?.address) {
      navigator.clipboard.writeText(paymentInfo.address);
      setCopied(true);
      toast.success("Address copied!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Map plan name to subscribe key
  const planKeyMap: Record<string, string> = {
    Storyteller: "storyteller",
    Creator: "creator",
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="container mx-auto px-4 py-16 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Simple, Affordable{" "}
            <span className="bg-gradient-to-r from-[#d4a04a] via-[#9b7dd4] to-[#6c3dbd] bg-clip-text text-transparent">
              Pricing
            </span>
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Start writing for free. Upgrade when you want AI-powered craft
            feedback, story collections, or creator monetization tools.
          </p>
          {subStatus.active && (
            <Badge className="mt-4 bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
              Active: {subStatus.plan} plan (expires {new Date(subStatus.expires_at!).toLocaleDateString()})
            </Badge>
          )}
        </motion.div>

        {/* Payment Modal */}
        <Dialog open={!!paymentInfo} onOpenChange={(open) => !open && clearPaymentInfo()}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Complete Payment</DialogTitle>
              <DialogDescription>
                Send exactly <strong>${paymentInfo?.amount} {paymentInfo?.currency}</strong> on <strong>{paymentInfo?.network}</strong> to the address below. Your <strong>{paymentInfo?.plan}</strong> subscription will activate automatically.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <p className="text-xs text-muted-foreground mb-1">Payment Address ({paymentInfo?.network})</p>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono break-all flex-1">
                    {paymentInfo?.address}
                  </code>
                  <Button variant="ghost" size="sm" onClick={copyAddress}>
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Amount</p>
                  <p className="font-semibold">${paymentInfo?.amount} {paymentInfo?.currency}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Network</p>
                  <p className="font-semibold">{paymentInfo?.network}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {paymentInfo?.note}
              </p>
              <Button
                className="w-full bg-gradient-to-r from-[#d4a04a] to-[#9b7dd4] hover:from-[#c49040] hover:to-[#8b6dc4] text-white"
                disabled={verifying}
                onClick={async () => {
                  const result = await verifyPayment();
                  if (result?.verified) {
                    toast.success(result.message);
                  } else if (result?.message) {
                    toast(result.message);
                  } else if (result?.error) {
                    toast.error(result.error);
                  }
                }}
              >
                {verifying ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Checking...</>
                ) : (
                  <><CheckCircle2 className="w-4 h-4 mr-2" /> I&apos;ve Sent Payment — Verify</>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-24">
          {plans.map((plan, index) => {
            const planKey = planKeyMap[plan.name];
            const isCurrentPlan = subStatus.active && subStatus.plan === planKey;
            const hasPendingPayment = subStatus.pending_payment?.plan === planKey;
            // Disable downgrade: if active on "creator", disable "storyteller" button
            const planTier: Record<string, number> = { free: 0, storyteller: 1, creator: 2 };
            const isDowngrade = subStatus.active && planKey
              ? (planTier[planKey] ?? 0) < (planTier[subStatus.plan] ?? 0)
              : false;

            return (
              <motion.div
                key={plan.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card
                  className={`relative h-full flex flex-col ${
                    plan.highlight
                      ? "border-2 border-[#d4a04a] shadow-lg shadow-[#d4a04a]/10"
                      : "border border-gray-200 dark:border-gray-700"
                  }`}
                >
                  {plan.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-gradient-to-r from-[#d4a04a] to-[#9b7dd4] text-white border-0 px-4 py-1">
                        {plan.badge}
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-4">
                    <div className="w-12 h-12 mx-auto mb-4 bg-gradient-to-r from-[#d4a04a]/20 to-[#9b7dd4]/20 rounded-full flex items-center justify-center">
                      <plan.icon className="w-6 h-6 text-[#d4a04a]" />
                    </div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        {plan.price}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400 ml-1">
                        {plan.period}
                      </span>
                    </div>
                    <CardDescription className="mt-2">
                      {plan.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 flex-1">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-3">
                          <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {feature}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-8">
                      {planKey ? (
                        <Button
                          className={`w-full ${
                            plan.highlight && !isCurrentPlan && !hasPendingPayment && !isDowngrade
                              ? "bg-gradient-to-r from-[#d4a04a] to-[#9b7dd4] hover:from-[#c49040] hover:to-[#8b6dc4] text-white"
                              : ""
                          }`}
                          variant={plan.highlight && !isCurrentPlan && !hasPendingPayment && !isDowngrade ? "default" : "outline"}
                          disabled={isCurrentPlan || isDowngrade || !!creatingPlan}
                          onClick={() => handleSubscribe(planKey)}
                        >
                          {creatingPlan === planKey ? (
                            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
                          ) : isCurrentPlan ? (
                            <><CheckCircle2 className="w-4 h-4 mr-2" /> Current Plan</>
                          ) : hasPendingPayment ? (
                            <>View Payment Address</>
                          ) : isDowngrade ? (
                            "Current plan is higher"
                          ) : (
                            plan.cta
                          )}
                        </Button>
                      ) : (
                        <Link href={plan.href}>
                          <Button
                            className={`w-full ${
                              plan.highlight
                                ? "bg-gradient-to-r from-[#d4a04a] to-[#9b7dd4] hover:from-[#c49040] hover:to-[#8b6dc4] text-white"
                                : ""
                            }`}
                            variant={plan.highlight ? "default" : "outline"}
                          >
                            {plan.cta}
                          </Button>
                        </Link>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        {/* Feature Comparison Highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-24"
        >
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Why Writers Choose eStories
          </h2>
          <div className="grid md:grid-cols-4 gap-6">
            {[
              {
                icon: Mic,
                title: "Voice-First",
                desc: "Speak your story naturally. AI transcribes and enhances it.",
              },
              {
                icon: Brain,
                title: "Craft Feedback",
                desc: "AI analyzes coherence, depth, and themes — helping you improve with every story.",
              },
              {
                icon: Shield,
                title: "Truly Private",
                desc: "AES-256-GCM encryption. Your PIN, your data. We can't read your stories.",
              },
              {
                icon: Lock,
                title: "Blockchain Provenance",
                desc: "Prove your story is authentically yours with tamper-proof on-chain proofs.",
              },
            ].map((item) => (
              <Card
                key={item.title}
                className="text-center p-6 border border-gray-200 dark:border-gray-700"
              >
                <item.icon className="w-8 h-8 mx-auto mb-3 text-[#d4a04a]" />
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {item.desc}
                </p>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="max-w-3xl mx-auto"
        >
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-8">
            Frequently Asked Questions
          </h2>
          <Card className="border border-gray-200 dark:border-gray-700">
            <CardContent className="py-2">
              {faqs.map((faq) => (
                <FAQItem
                  key={faq.question}
                  question={faq.question}
                  answer={faq.answer}
                />
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-center mt-16"
        >
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Ready to start your storytelling journey?
          </p>
          <Link href="/record">
            <Button
              size="lg"
              className="bg-gradient-to-r from-[#d4a04a] to-[#9b7dd4] hover:from-[#c49040] hover:to-[#8b6dc4] text-white"
            >
              <Zap className="w-4 h-4 mr-2" />
              Start Writing — Free
            </Button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
