// Onboarding Screen - 4-step wizard: Profile → Vault → Wallet → Done
// Matches web app's onboarding flow
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import {
  User,
  AtSign,
  Mail,
  ArrowRight,
  ArrowLeft,
  Shield,
  Wallet,
  Check,
  ChevronRight,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAccount } from "wagmi";
import { useAppKit } from "@reown/appkit-react-native";
import { useAuthStore } from "../../stores/authStore";
import { WEB3_FEATURES_ENABLED } from "../../lib/releaseConfig";
import {
  GlassCard,
  GradientButton,
  GradientText,
  AnimatedListItem,
  Badge,
  GRADIENTS,
} from "../../components/ui";

type OnboardingStep = "profile" | "vault" | "wallet" | "done";

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OnboardingScreen() {
  const { completeOnboarding, user, authMethod } = useAuthStore();
  const { isConnected } = useAccount();
  const { open } = useAppKit();

  const skipWallet =
    !WEB3_FEATURES_ENABLED || authMethod === "wallet" || isConnected;

  const [step, setStep] = useState<OnboardingStep>("profile");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const steps: OnboardingStep[] = skipWallet
    ? ["profile", "vault", "done"]
    : ["profile", "vault", "wallet", "done"];

  const currentIndex = steps.indexOf(step);
  const progress = (currentIndex + 1) / steps.length;

  const handleProfileSubmit = async () => {
    if (!name.trim()) {
      Toast.show({ type: "error", text1: "Name is required" });
      return;
    }
    if (!username.trim()) {
      Toast.show({ type: "error", text1: "Username is required" });
      return;
    }
    if (!USERNAME_REGEX.test(username.trim())) {
      Toast.show({
        type: "error",
        text1: "Username must be 3-20 chars, alphanumeric + underscore only",
      });
      return;
    }
    if (email.trim() && !EMAIL_REGEX.test(email.trim())) {
      Toast.show({ type: "error", text1: "Invalid email format" });
      return;
    }

    setLoading(true);
    try {
      await completeOnboarding({ name: name.trim(), username: username.trim(), email: email.trim() });
      setStep("vault");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Profile setup failed";
      Toast.show({ type: "error", text1: msg });
    } finally {
      setLoading(false);
    }
  };

  const handleVaultSkip = () => {
    // Vault is optional on mobile (handled by native secure storage)
    const nextStep = skipWallet ? "done" : "wallet";
    setStep(nextStep);
  };

  const handleWalletConnect = async () => {
    try {
      await open();
      // Once connected, auto-advance
      setStep("done");
    } catch {
      // User cancelled or error
    }
  };

  const handleFinish = () => {
    Toast.show({ type: "success", text1: "Welcome to eStories!" });
    router.replace("/");
  };

  const goBack = () => {
    const prevIndex = currentIndex - 1;
    if (prevIndex >= 0) {
      setStep(steps[prevIndex]);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={{ flex: 1, paddingHorizontal: 24 }}>
        {/* Progress Bar */}
        <View style={{ paddingTop: 16, paddingBottom: 8 }}>
          <View
            style={{
              height: 4,
              borderRadius: 2,
              backgroundColor: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <LinearGradient
              colors={GRADIENTS.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={{
                height: 4,
                borderRadius: 2,
                width: `${progress * 100}%`,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <Text style={{ fontSize: 12, color: "#64748b" }}>
              Step {currentIndex + 1} of {steps.length}
            </Text>
            {currentIndex > 0 && (
              <TouchableOpacity onPress={goBack}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <ArrowLeft size={14} color="#a78bfa" />
                  <Text style={{ fontSize: 12, color: "#a78bfa" }}>Back</Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Step: Profile */}
        {step === "profile" && (
          <>
            <AnimatedListItem index={0}>
              <View style={{ paddingVertical: 24 }}>
                <GradientText
                  text="Set Up Profile"
                  gradient={GRADIENTS.primary}
                  style={{ fontSize: 28 }}
                />
                <Text style={{ marginTop: 8, fontSize: 15, color: "#94a3b8" }}>
                  Tell us a bit about yourself
                </Text>
              </View>
            </AnimatedListItem>

            <View style={{ gap: 16 }}>
              <AnimatedListItem index={1}>
                <GlassCard
                  intensity="light"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <User size={20} color="#a78bfa" />
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Full Name"
                    style={{ flex: 1, fontSize: 15, color: "#fff" }}
                    placeholderTextColor="#64748b"
                    autoFocus
                  />
                </GlassCard>
              </AnimatedListItem>

              <AnimatedListItem index={2}>
                <GlassCard
                  intensity="light"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <AtSign size={20} color="#a78bfa" />
                  <TextInput
                    value={username}
                    onChangeText={setUsername}
                    placeholder="Username (3-20 chars)"
                    style={{ flex: 1, fontSize: 15, color: "#fff" }}
                    placeholderTextColor="#64748b"
                    autoCapitalize="none"
                  />
                </GlassCard>
              </AnimatedListItem>

              <AnimatedListItem index={3}>
                <GlassCard
                  intensity="light"
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                  }}
                >
                  <Mail size={20} color="#a78bfa" />
                  <TextInput
                    value={email}
                    onChangeText={setEmail}
                    placeholder="Email (optional)"
                    style={{ flex: 1, fontSize: 15, color: "#fff" }}
                    placeholderTextColor="#64748b"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </GlassCard>
              </AnimatedListItem>

              <AnimatedListItem index={4}>
                <View style={{ marginTop: 8 }}>
                  <GradientButton
                    onPress={handleProfileSubmit}
                    title="Continue"
                    icon={<ArrowRight size={20} color="#fff" />}
                    gradient={GRADIENTS.primary}
                    size="lg"
                    loading={loading}
                    disabled={loading}
                    fullWidth
                  />
                </View>
              </AnimatedListItem>
            </View>
          </>
        )}

        {/* Step: Vault */}
        {step === "vault" && (
          <>
            <AnimatedListItem index={0}>
              <View style={{ paddingVertical: 24 }}>
                <GradientText
                  text="Secure Your Stories"
                  gradient={GRADIENTS.success}
                  style={{ fontSize: 28 }}
                />
                <Text style={{ marginTop: 8, fontSize: 15, color: "#94a3b8" }}>
                  Understand how your story data is handled
                </Text>
              </View>
            </AnimatedListItem>

            <AnimatedListItem index={1}>
              <GlassCard intensity="medium" style={{ padding: 24, alignItems: "center" }}>
                <Shield size={48} color="#4ade80" />
                <Text
                  style={{
                    marginTop: 16,
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  Secure Story Processing
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: "#94a3b8",
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  Story content is sent securely to eStories services when you save
                  or use AI features. Local drafts can remain on this device until
                  they are saved or removed.
                </Text>
                <View style={{ marginTop: 16, flexDirection: "row", gap: 8 }}>
                  <Badge text="Secure transport" variant="success" />
                  <Badge text="Deletion controls" variant="violet" />
                </View>
              </GlassCard>
            </AnimatedListItem>

            <AnimatedListItem index={2}>
              <View style={{ marginTop: 24 }}>
                <GradientButton
                  onPress={handleVaultSkip}
                  title="Continue"
                  icon={<ChevronRight size={20} color="#fff" />}
                  gradient={GRADIENTS.primary}
                  size="lg"
                  fullWidth
                />
              </View>
            </AnimatedListItem>
          </>
        )}

        {/* Step: Wallet (optional for Google users) */}
        {WEB3_FEATURES_ENABLED && step === "wallet" && (
          <>
            <AnimatedListItem index={0}>
              <View style={{ paddingVertical: 24 }}>
                <GradientText
                  text="Connect Wallet"
                  gradient={GRADIENTS.accent}
                  style={{ fontSize: 28 }}
                />
                <Text style={{ marginTop: 8, fontSize: 15, color: "#94a3b8" }}>
                  Optional — enables tipping, NFT minting, and on-chain provenance
                </Text>
              </View>
            </AnimatedListItem>

            <AnimatedListItem index={1}>
              <GlassCard intensity="medium" style={{ padding: 24, alignItems: "center" }}>
                <Wallet size={48} color="#60a5fa" />
                <Text
                  style={{
                    marginTop: 16,
                    fontSize: 16,
                    fontWeight: "600",
                    color: "#fff",
                    textAlign: "center",
                  }}
                >
                  Blockchain Features
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    fontSize: 14,
                    color: "#94a3b8",
                    textAlign: "center",
                    lineHeight: 20,
                  }}
                >
                  A wallet lets you tip creators, mint story NFTs, set paywalls,
                  and get cryptographic proofs of your stories on Base L2.
                </Text>
              </GlassCard>
            </AnimatedListItem>

            <AnimatedListItem index={2}>
              <View style={{ marginTop: 24, gap: 12 }}>
                <GradientButton
                  onPress={handleWalletConnect}
                  title="Connect Wallet"
                  icon={<Wallet size={20} color="#fff" />}
                  gradient={GRADIENTS.accent}
                  size="lg"
                  fullWidth
                />
                <TouchableOpacity
                  onPress={() => setStep("done")}
                  style={{ alignItems: "center", paddingVertical: 8 }}
                >
                  <Text style={{ fontSize: 14, color: "#94a3b8" }}>
                    Skip for now
                  </Text>
                </TouchableOpacity>
              </View>
            </AnimatedListItem>
          </>
        )}

        {/* Step: Done */}
        {step === "done" && (
          <>
            <AnimatedListItem index={0}>
              <View style={{ paddingVertical: 48, alignItems: "center" }}>
                <View
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    backgroundColor: "rgba(74, 222, 128, 0.15)",
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 24,
                  }}
                >
                  <Check size={40} color="#4ade80" />
                </View>
                <GradientText
                  text="You're All Set!"
                  gradient={GRADIENTS.success}
                  style={{ fontSize: 28 }}
                />
                <Text
                  style={{
                    marginTop: 12,
                    fontSize: 15,
                    color: "#94a3b8",
                    textAlign: "center",
                    lineHeight: 22,
                  }}
                >
                  Welcome to eStories. Start writing about anything you're
                  passionate about — journals, history, culture, creative
                  non-fiction. Your stories, your rules.
                </Text>
              </View>
            </AnimatedListItem>

            <AnimatedListItem index={1}>
              <GradientButton
                onPress={handleFinish}
                title="Start Writing"
                icon={<ArrowRight size={20} color="#fff" />}
                gradient={GRADIENTS.primary}
                size="lg"
                fullWidth
              />
            </AnimatedListItem>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
