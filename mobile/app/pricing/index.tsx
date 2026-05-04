// Pricing Screen - Display eStories subscription tiers
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { ArrowLeft, Check, X, Star, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  GlassCard,
  GradientButton,
  GradientText,
  AnimatedListItem,
  Badge,
  GRADIENTS,
} from "../../components/ui";
import { TestnetBanner } from "../../components/TestnetBanner";

interface Plan {
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
  const [selectedPlan, setSelectedPlan] = useState(1); // Default to Storyteller

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
            Start free, upgrade when you're ready. All plans include encrypted
            storage and blockchain provenance.
          </Text>
        </AnimatedListItem>

        {PLANS.map((plan, idx) => {
          const isSelected = selectedPlan === idx;
          return (
            <AnimatedListItem key={plan.name} index={idx + 1}>
              <TouchableOpacity
                onPress={() => setSelectedPlan(idx)}
                activeOpacity={0.8}
                style={{ marginBottom: 16 }}
              >
                <GlassCard
                  intensity={isSelected ? "heavy" : "light"}
                  style={{
                    padding: 20,
                    borderWidth: isSelected ? 1 : 0,
                    borderColor: isSelected ? plan.gradient[0] : "transparent",
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
                        <Text style={{ fontSize: 12, color: "#94a3b8" }}>
                          {plan.period}
                        </Text>
                      )}
                    </View>
                  </View>

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
                      <Text style={{ flex: 1, fontSize: 13, color: "#cbd5e1" }}>
                        {feature}
                      </Text>
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
                      <Text style={{ flex: 1, fontSize: 13, color: "#64748b" }}>
                        {limitation}
                      </Text>
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
            onPress={() => router.push("/record")}
            title={selectedPlan === 0 ? "Get Started Free" : "Start Writing"}
            gradient={PLANS[selectedPlan].gradient as [string, string, ...string[]]}
            size="lg"
            fullWidth
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
            ].map((item, idx) => (
              <GlassCard
                key={item.title}
                intensity="light"
                style={{ padding: 14, marginBottom: 8 }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#fff" }}>
                  {item.title}
                </Text>
                <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                  {item.desc}
                </Text>
              </GlassCard>
            ))}
          </View>
        </AnimatedListItem>
      </ScrollView>
    </SafeAreaView>
  );
}
