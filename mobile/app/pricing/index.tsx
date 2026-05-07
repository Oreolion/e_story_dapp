// Pricing Screen — eStories subscription tiers with Blockradar checkout
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  ArrowLeft,
  Check,
  X,
  Star,
  Zap,
  Copy,
  CopyCheck,
  RefreshCw,
  Wallet,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Clipboard from "expo-clipboard";
import Toast from "react-native-toast-message";
import {
  GlassCard,
  GradientButton,
  GradientText,
  AnimatedListItem,
  Badge,
  GRADIENTS,
} from "../../components/ui";
import { TestnetBanner } from "../../components/TestnetBanner";
import { useSubscription } from "../../hooks/useSubscription";
import { useAuthStore } from "../../stores/authStore";

interface Plan {
  id: string;
  name: string;
  price: string;
  period?: string;
  badge?: string;
  features: string[];
  limitations?: string[];
  gradient: [string, string, ...string[]];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    features: [
      "Unlimited story recording & writing",
      "AI transcription",
      "AI text enhancement",
      "10 AI story analyses per month",
      "Encrypted local vault",
      "Public feed access",
      "Like & follow",
      "Basic insights",
    ],
    limitations: ["5 analyses/month", "No actionable advice", "No collections"],
    gradient: ["#64748b", "#475569"],
  },
  {
    id: "storyteller",
    name: "Storyteller",
    price: "$2.99",
    period: "/month",
    badge: "Most Popular",
    features: [
      "Everything in Free",
      "Unlimited AI analyses",
      "Actionable AI advice",
      "Story collections & continuations",
      "Weekly reflections",
      "Priority CRE verification",
      "Advanced pattern tracking",
      "Progress reports",
    ],
    gradient: ["#7c3aed", "#6366f1"],
  },
  {
    id: "creator",
    name: "Creator",
    price: "$7.99",
    period: "/month",
    features: [
      "Everything in Storyteller",
      "Unlimited public publishing",
      "Custom paywall pricing",
      "NFT minting (no fee)",
      "Creator analytics",
      "Tip collection",
      "Priority support",
      "Custom profile page",
      "Early access",
    ],
    gradient: ["#d4a04a", "#b8860b"],
  },
];

export default function PricingScreen() {
  const { isAuthenticated, subscription } = useAuthStore();
  const {
    status,
    paymentInfo,
    creatingPlan,
    verifying,
    subscribe,
    verifyPayment,
    clearPaymentInfo,
    refreshStatus,
  } = useSubscription();

  const [selectedPlan, setSelectedPlan] = useState(1);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  // Pre-select current subscription plan if active
  useEffect(() => {
    if (subscription.active) {
      const idx = PLANS.findIndex((p) => p.id === subscription.plan);
      if (idx >= 0) setSelectedPlan(idx);
    }
  }, [subscription.active, subscription.plan]);

  // Auto-close modal on successful activation
  useEffect(() => {
    if (status.active && showPaymentModal) {
      setShowPaymentModal(false);
      clearPaymentInfo();
      Toast.show({
        type: "success",
        text1: `${PLANS.find((p) => p.id === status.plan)?.name ?? "Subscription"} activated!`,
        text2: "Enjoy your premium features.",
      });
    }
  }, [status.active, status.plan, showPaymentModal, clearPaymentInfo]);

  const handleCTA = async () => {
    const plan = PLANS[selectedPlan];

    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (plan.id === "free") {
      router.push("/record");
      return;
    }

    // Already active on this plan
    if (subscription.active && subscription.plan === plan.id) {
      Toast.show({ type: "info", text1: "You already have this plan!" });
      return;
    }

    // Active on a higher plan — prevent downgrade for now
    const planHierarchy: Record<string, number> = { free: 0, storyteller: 1, creator: 2 };
    if (
      subscription.active &&
      planHierarchy[subscription.plan] > planHierarchy[plan.id]
    ) {
      Alert.alert(
        "Downgrade Not Available",
        "Please contact support to change your subscription plan."
      );
      return;
    }

    try {
      setVerifyMessage(null);
      await subscribe(plan.id);
      setShowPaymentModal(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to start checkout";
      Toast.show({ type: "error", text1: message });
    }
  };

  const handleCopyAddress = async () => {
    if (!paymentInfo?.address) return;
    await Clipboard.setStringAsync(paymentInfo.address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    Toast.show({ type: "success", text1: "Address copied!", visibilityTime: 1500 });
  };

  const handleVerify = async () => {
    setVerifyMessage(null);
    const result = await verifyPayment();
    setVerifyMessage(result.message ?? null);

    if (result.verified) {
      Toast.show({
        type: "success",
        text1: "Payment confirmed!",
        text2: "Your subscription is now active.",
      });
      setShowPaymentModal(false);
    } else {
      Toast.show({
        type: "info",
        text1: result.message || "No deposit found yet",
        text2: "Please send USDC and try again in a moment.",
      });
    }
  };

  const selectedPlanData = PLANS[selectedPlan];
  const isCurrentPlan = subscription.active && subscription.plan === selectedPlanData.id;
  const ctaTitle = isCurrentPlan
    ? "Current Plan"
    : selectedPlanData.id === "free"
    ? "Get Started Free"
    : "Subscribe Now";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity onPress={() => router.back()} style={{ padding: 4 }}>
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text
          style={{
            flex: 1,
            textAlign: "center",
            fontSize: 18,
            fontWeight: "700",
            color: "#fff",
          }}
        >
          Choose Your Plan
        </Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
      >
        <AnimatedListItem index={0}>
          <TestnetBanner />
          <Text
            style={{
              textAlign: "center",
              fontSize: 14,
              color: "#94a3b8",
              marginBottom: 24,
              lineHeight: 20,
            }}
          >
            Start free, upgrade when you&apos;re ready. All plans include encrypted
            storage and blockchain provenance.
          </Text>
        </AnimatedListItem>

        {/* Current plan badge */}
        {subscription.active && (
          <AnimatedListItem index={0.5}>
            <GlassCard
              intensity="medium"
              style={{ padding: 12, marginBottom: 16, alignItems: "center" }}
            >
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>
                Your plan:{" "}
                <Text style={{ fontWeight: "700", color: "#4ade80" }}>
                  {subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)}
                </Text>
                {subscription.expires_at && (
                  <Text style={{ color: "#64748b" }}>
                    {" "}(expires{" "}
                    {new Date(subscription.expires_at).toLocaleDateString()})
                  </Text>
                )}
              </Text>
            </GlassCard>
          </AnimatedListItem>
        )}

        {PLANS.map((plan, idx) => {
          const isSelected = selectedPlan === idx;
          const isActive = subscription.active && subscription.plan === plan.id;
          return (
            <AnimatedListItem key={plan.id} index={idx + 1}>
              <TouchableOpacity
                onPress={() => setSelectedPlan(idx)}
                activeOpacity={0.8}
                style={{ marginBottom: 16 }}
              >
                <GlassCard
                  intensity={isSelected ? "heavy" : "light"}
                  style={{
                    padding: 20,
                    borderWidth: isSelected || isActive ? 1 : 0,
                    borderColor: isActive ? "#4ade80" : isSelected ? plan.gradient[0] : "transparent",
                  }}
                >
                  {/* Plan Header */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <LinearGradient
                        colors={plan.gradient}
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        {idx === 0 ? (
                          <Zap size={18} color="#fff" />
                        ) : idx === 1 ? (
                          <Star size={18} color="#fff" />
                        ) : (
                          <Star size={18} color="#fff" fill="#fff" />
                        )}
                      </LinearGradient>
                      <View>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: "#fff" }}>
                          {plan.name}
                        </Text>
                        {plan.badge && <Badge text={plan.badge} variant="violet" />}
                      </View>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={{ fontSize: 24, fontWeight: "800", color: "#fff" }}>
                        {plan.price}
                      </Text>
                      {plan.period && (
                        <Text style={{ fontSize: 12, color: "#94a3b8" }}>{plan.period}</Text>
                      )}
                    </View>
                  </View>

                  {/* Active indicator */}
                  {isActive && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                      <Check size={14} color="#4ade80" />
                      <Text style={{ fontSize: 12, color: "#4ade80", fontWeight: "600" }}>
                        Currently active
                      </Text>
                    </View>
                  )}

                  {/* Features */}
                  {plan.features.map((feature) => (
                    <View
                      key={feature}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <Check size={14} color="#4ade80" />
                      <Text style={{ flex: 1, fontSize: 13, color: "#cbd5e1" }}>{feature}</Text>
                    </View>
                  ))}

                  {/* Limitations */}
                  {plan.limitations?.map((limitation) => (
                    <View
                      key={limitation}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 6,
                      }}
                    >
                      <X size={14} color="#64748b" />
                      <Text style={{ flex: 1, fontSize: 13, color: "#64748b" }}>{limitation}</Text>
                    </View>
                  ))}
                </GlassCard>
              </TouchableOpacity>
            </AnimatedListItem>
          );
        })}

        {/* CTA */}
        <AnimatedListItem index={4}>
          <GradientButton
            onPress={handleCTA}
            title={creatingPlan ? "Creating Payment..." : ctaTitle}
            gradient={PLANS[selectedPlan].gradient as [string, string, ...string[]]}
            size="lg"
            fullWidth
            disabled={creatingPlan !== null || isCurrentPlan}
          />
        </AnimatedListItem>

        {/* Why Writers Choose eStories */}
        <AnimatedListItem index={5}>
          <View style={{ marginTop: 32 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: "700",
                color: "#fff",
                textAlign: "center",
                marginBottom: 16,
              }}
            >
              Why Writers Choose eStories
            </Text>
            {[
              { title: "Voice-First", desc: "Speak your story naturally — AI handles the rest" },
              { title: "Craft Feedback", desc: "AI analyzes coherence, depth, themes — helping you improve" },
              { title: "Truly Private", desc: "AES-256-GCM encryption. We literally cannot read them." },
              { title: "Blockchain Provenance", desc: "Prove your story is authentically yours, on-chain" },
            ].map((item) => (
              <GlassCard key={item.title} intensity="light" style={{ padding: 14, marginBottom: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>{item.title}</Text>
                <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{item.desc}</Text>
              </GlassCard>
            ))}
          </View>
        </AnimatedListItem>
      </ScrollView>

      {/* Payment Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade">
        <SafeAreaView style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "center",
              padding: 24,
            }}
          >
            <GlassCard intensity="heavy" style={{ padding: 24 }}>
              {/* Header */}
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 16,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "700", color: "#fff" }}>
                  Complete Payment
                </Text>
                <TouchableOpacity onPress={() => { setShowPaymentModal(false); clearPaymentInfo(); }}>
                  <X size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              {!paymentInfo ? (
                <View style={{ alignItems: "center", paddingVertical: 32 }}>
                  <ActivityIndicator size="large" color="#a78bfa" />
                  <Text style={{ marginTop: 16, color: "#94a3b8" }}>
                    Generating payment address...
                  </Text>
                </View>
              ) : (
                <>
                  {/* Amount */}
                  <View style={{ alignItems: "center", marginBottom: 20 }}>
                    <Text style={{ fontSize: 14, color: "#94a3b8" }}>Send exactly</Text>
                    <Text style={{ fontSize: 32, fontWeight: "800", color: "#fff", marginTop: 4 }}>
                      {paymentInfo.amount} {paymentInfo.currency}
                    </Text>
                    <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                      on {paymentInfo.network}
                    </Text>
                  </View>

                  {/* Address */}
                  <GlassCard intensity="light" style={{ padding: 16, marginBottom: 16 }}>
                    <Text style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>
                      Payment Address
                    </Text>
                    <Text
                      style={{
                        fontFamily: "monospace",
                        fontSize: 13,
                        color: "#fff",
                        lineHeight: 20,
                      }}
                      selectable
                    >
                      {paymentInfo.address}
                    </Text>
                    <TouchableOpacity
                      onPress={handleCopyAddress}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                        marginTop: 12,
                        alignSelf: "flex-start",
                      }}
                    >
                      {copied ? (
                        <CopyCheck size={16} color="#4ade80" />
                      ) : (
                        <Copy size={16} color="#a78bfa" />
                      )}
                      <Text style={{ fontSize: 13, color: copied ? "#4ade80" : "#a78bfa" }}>
                        {copied ? "Copied!" : "Copy Address"}
                      </Text>
                    </TouchableOpacity>
                  </GlassCard>

                  {/* Instructions */}
                  <Text style={{ fontSize: 13, color: "#94a3b8", lineHeight: 20, marginBottom: 16 }}>
                    {paymentInfo.note}
                  </Text>

                  {/* Verify button */}
                  <GradientButton
                    onPress={handleVerify}
                    title={verifying ? "Checking..." : "I've Sent the Payment"}
                    icon={<RefreshCw size={18} color="#fff" />}
                    gradient={GRADIENTS.primary}
                    fullWidth
                    disabled={verifying}
                  />

                  {/* Manual refresh */}
                  <TouchableOpacity
                    onPress={refreshStatus}
                    style={{ alignSelf: "center", marginTop: 12 }}
                  >
                    <Text style={{ fontSize: 13, color: "#64748b" }}>Refresh status</Text>
                  </TouchableOpacity>

                  {/* Verify message */}
                  {verifyMessage && (
                    <Text
                      style={{
                        marginTop: 12,
                        fontSize: 13,
                        color: "#fbbf24",
                        textAlign: "center",
                      }}
                    >
                      {verifyMessage}
                    </Text>
                  )}

                  {/* Status indicator */}
                  {status.pending_payment && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 16,
                        justifyContent: "center",
                      }}
                    >
                      <Wallet size={14} color="#a78bfa" />
                      <Text style={{ fontSize: 12, color: "#a78bfa" }}>
                        Waiting for deposit...
                      </Text>
                    </View>
                  )}
                </>
              )}
            </GlassCard>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
