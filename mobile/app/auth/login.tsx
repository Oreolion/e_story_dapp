// Login Screen - Email/password + Google OAuth
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Mail, Lock, X, Wallet } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAccount, useSignMessage } from "wagmi";
import { useAppKit } from "@reown/appkit-react-native";
import { useAuthStore } from "../../stores/authStore";
import { signInWithGoogleNative } from "../../lib/googleAuth";
import { loginSchema } from "../../lib/validation";
import {
  GlassCard,
  GradientButton,
  GradientText,
  AnimatedListItem,
  GRADIENTS,
  GLASS,
} from "../../components/ui";

export default function LoginScreen() {
  const { loginWithEmail, loginWithGoogleIdToken, loginWithWallet, resetPassword } = useAuthStore();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { open } = useAppKit();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [walletLoading, setWalletLoading] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const handleEmailLogin = async () => {
    setFieldErrors({});
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
      Toast.show({ type: "success", text1: "Signed in!" });
      router.replace("/");
    } catch (err) {
      console.error("[Login] Email login failed:", err);
      const message = err instanceof Error ? err.message : "Login failed. Try again.";
      Toast.show({ type: "error", text1: message });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    Alert.prompt
      ? Alert.prompt(
          "Reset Password",
          "Enter your email address",
          async (inputEmail) => {
            if (!inputEmail?.trim()) return;
            try {
              await resetPassword(inputEmail.trim());
              Alert.alert("Check your email", "A password reset link has been sent.");
            } catch {
              Alert.alert("Error", "Failed to send reset email. Try again.");
            }
          },
          "plain-text",
          email,
          "email-address"
        )
      : (async () => {
          if (!email.trim()) {
            Toast.show({ type: "error", text1: "Enter your email first, then tap Forgot password" });
            return;
          }
          try {
            await resetPassword(email.trim());
            Alert.alert("Check your email", "A password reset link has been sent.");
          } catch {
            Alert.alert("Error", "Failed to send reset email. Try again.");
          }
        })();
  };

  // Auto-login after wallet connection
  React.useEffect(() => {
    if (isConnected && address && walletLoading) {
      handleWalletLogin();
    }
  }, [isConnected, address]);

  const handleWalletConnect = async () => {
    setWalletLoading(true);
    try {
      await open();
      // Login will be triggered by the useEffect above when wallet connects
    } catch {
      setWalletLoading(false);
    }
  };

  const handleWalletLogin = async () => {
    if (!address) {
      setWalletLoading(false);
      return;
    }
    try {
      await loginWithWallet(address, async (message: string) => {
        return await signMessageAsync({ message });
      });
      Toast.show({ type: "success", text1: "Signed in with wallet!" });
      router.replace("/");
    } catch (err) {
      console.error("[Login] Wallet login failed:", err);
      Toast.show({ type: "error", text1: "Wallet sign-in failed. Try again." });
    } finally {
      setWalletLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    try {
      const result = await signInWithGoogleNative();
      if (!result) return;

      const { needsOnboarding } = await loginWithGoogleIdToken(
        result.accessToken,
        result.refreshToken
      );

      Toast.show({ type: "success", text1: "Signed in with Google!" });
      router.replace(needsOnboarding ? "/auth/onboarding" : "/");
    } catch (err) {
      console.error("[Login] Google login failed:", err);
      Toast.show({ type: "error", text1: "Google sign-in failed. Try again." });
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ flex: 1, paddingHorizontal: 24 }}>
            {/* Close button */}
            <View style={{ flexDirection: "row", justifyContent: "flex-end", paddingVertical: 16 }}>
              <TouchableOpacity onPress={() => router.back()}>
                <X size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Hero */}
            <LinearGradient
              colors={GRADIENTS.hero}
              style={{ alignItems: "center", paddingTop: 32, paddingBottom: 40, marginHorizontal: -24, paddingHorizontal: 24 }}
            >
              <AnimatedListItem index={0}>
                <GradientText
                  text="eStories"
                  gradient={GRADIENTS.primary}
                  style={{ fontSize: 40 }}
                />
              </AnimatedListItem>
              <AnimatedListItem index={1}>
                <Text style={{ marginTop: 8, textAlign: "center", fontSize: 15, color: "#94a3b8", lineHeight: 22 }}>
                  AI-powered sovereign storytelling.{"\n"}Your stories, on-chain forever.
                </Text>
              </AnimatedListItem>
            </LinearGradient>

            {/* Email & Password */}
            <View style={{ gap: 12, marginTop: 8 }}>
              <AnimatedListItem index={2}>
                <View>
                  <GlassCard
                    intensity="light"
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}
                  >
                    <Mail size={20} color="#a78bfa" />
                    <TextInput
                      value={email}
                      onChangeText={(text) => { setEmail(text); setFieldErrors((prev) => ({ ...prev, email: "" })); }}
                      placeholder="Email"
                      style={{ flex: 1, fontSize: 15, color: "#fff" }}
                      placeholderTextColor="#64748b"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </GlassCard>
                  {fieldErrors.email && (
                    <Text style={{ marginTop: 4, marginLeft: 4, fontSize: 12, color: "#f87171" }}>
                      {fieldErrors.email}
                    </Text>
                  )}
                </View>
              </AnimatedListItem>

              <AnimatedListItem index={3}>
                <View>
                  <GlassCard
                    intensity="light"
                    style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}
                  >
                    <Lock size={20} color="#a78bfa" />
                    <TextInput
                      value={password}
                      onChangeText={(text) => { setPassword(text); setFieldErrors((prev) => ({ ...prev, password: "" })); }}
                      placeholder="Password"
                      style={{ flex: 1, fontSize: 15, color: "#fff" }}
                      placeholderTextColor="#64748b"
                      secureTextEntry
                    />
                  </GlassCard>
                  {fieldErrors.password && (
                    <Text style={{ marginTop: 4, marginLeft: 4, fontSize: 12, color: "#f87171" }}>
                      {fieldErrors.password}
                    </Text>
                  )}
                </View>
              </AnimatedListItem>

              {/* Sign In button */}
              <AnimatedListItem index={4}>
                <GradientButton
                  onPress={handleEmailLogin}
                  title="Sign In"
                  gradient={GRADIENTS.primary}
                  size="lg"
                  loading={loading}
                  disabled={loading}
                  fullWidth
                />
              </AnimatedListItem>

              {/* Forgot password */}
              <TouchableOpacity onPress={handleForgotPassword} style={{ alignItems: "center", paddingVertical: 4 }}>
                <Text style={{ fontSize: 13, color: "#a78bfa" }}>Forgot password?</Text>
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }}>
              <View style={{ height: 1, flex: 1, backgroundColor: GLASS.light.border }} />
              <Text style={{ fontSize: 13, color: "#64748b" }}>or</Text>
              <View style={{ height: 1, flex: 1, backgroundColor: GLASS.light.border }} />
            </View>

            {/* Google Sign In */}
            <AnimatedListItem index={5}>
              <GlassCard
                intensity="medium"
                style={{ overflow: "hidden" }}
              >
                <TouchableOpacity
                  onPress={handleGoogleLogin}
                  disabled={googleLoading}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    paddingVertical: 16,
                    opacity: googleLoading ? 0.5 : 1,
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                    {googleLoading ? "Signing in..." : "Continue with Google"}
                  </Text>
                </TouchableOpacity>
              </GlassCard>
            </AnimatedListItem>

            {/* Wallet Sign In */}
            <AnimatedListItem index={6}>
              <View style={{ marginTop: 12 }}>
                <GlassCard
                  intensity="medium"
                  style={{ overflow: "hidden" }}
                >
                  <TouchableOpacity
                    onPress={handleWalletConnect}
                    disabled={walletLoading}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      paddingVertical: 16,
                      opacity: walletLoading ? 0.5 : 1,
                    }}
                  >
                    <Wallet size={20} color="#a78bfa" />
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                      {walletLoading ? "Connecting..." : "Connect Wallet"}
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
              </View>
            </AnimatedListItem>

            {/* Sign Up link */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 32, paddingBottom: 16 }}>
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>Don't have an account?</Text>
              <TouchableOpacity onPress={() => router.push("/auth/signup")}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#a78bfa" }}>Sign Up</Text>
              </TouchableOpacity>
            </View>

            {/* Terms */}
            <Text style={{ textAlign: "center", fontSize: 11, color: "#64748b", paddingBottom: 16 }}>
              By continuing, you agree to our{" "}
              <Text
                style={{ color: "#a78bfa", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("https://estories.app/terms")}
              >
                Terms of Service
              </Text>
              {" "}and{" "}
              <Text
                style={{ color: "#a78bfa", textDecorationLine: "underline" }}
                onPress={() => Linking.openURL("https://estories.app/privacy")}
              >
                Privacy Policy
              </Text>
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
