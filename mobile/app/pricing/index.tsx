import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react-native";

import {
  AnimatedListItem,
  GlassCard,
  GradientButton,
  GradientText,
  GRADIENTS,
} from "../../components/ui";
import { useAuthStore } from "../../stores/authStore";

const INCLUDED_FEATURES = [
  "Record, write, and organize stories",
  "AI-assisted transcription and writing tools",
  "Read and participate in the public story community",
  "Use an existing account entitlement after signing in",
];

export default function PricingScreen() {
  const { isAuthenticated, subscription } = useAuthStore();
  const currentPlan = subscription.active ? subscription.plan : "free";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingHorizontal: 16,
          paddingVertical: 12,
        }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          style={{ flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: "#fff" }}
        >
          Mobile Access
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 64 }}
      >
        <AnimatedListItem index={0}>
          <View style={{ alignItems: "center", paddingVertical: 20 }}>
            <GradientText text="Write freely on mobile" gradient={GRADIENTS.primary} style={{ fontSize: 28 }} />
            <Text style={{ marginTop: 10, color: "#94a3b8", textAlign: "center", lineHeight: 21 }}>
              This Google Play release does not sell subscriptions, tokens, or digital items.
            </Text>
          </View>
        </AnimatedListItem>

        <AnimatedListItem index={1}>
          <GlassCard intensity="medium" style={{ padding: 20, marginBottom: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <Sparkles size={22} color="#a78bfa" />
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 17, fontWeight: "700" }}>Your access</Text>
                <Text style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>
                  {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)} plan
                </Text>
              </View>
            </View>

            {INCLUDED_FEATURES.map((feature) => (
              <View key={feature} style={{ flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 10 }}>
                <Check size={16} color="#4ade80" style={{ marginTop: 2 }} />
                <Text style={{ flex: 1, color: "#cbd5e1", fontSize: 14, lineHeight: 20 }}>{feature}</Text>
              </View>
            ))}
          </GlassCard>
        </AnimatedListItem>

        <AnimatedListItem index={2}>
          <GlassCard intensity="light" style={{ padding: 18, marginBottom: 20 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <ShieldCheck size={20} color="#60a5fa" />
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>How story data is used</Text>
            </View>
            <Text style={{ color: "#94a3b8", fontSize: 13, lineHeight: 20 }}>
              Story content is sent securely to eStories services when you save a story or use AI features.
              Review the Privacy Policy from your profile for processing and deletion details.
            </Text>
          </GlassCard>
        </AnimatedListItem>

        <AnimatedListItem index={3}>
          <GradientButton
            onPress={() => router.push(isAuthenticated ? "/record" : "/auth/login")}
            title={isAuthenticated ? "Start Writing" : "Sign In to Continue"}
            gradient={GRADIENTS.primary}
            size="lg"
            fullWidth
          />
        </AnimatedListItem>
      </ScrollView>
    </SafeAreaView>
  );
}
