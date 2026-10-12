// Signup Screen - Email/password registration + Google OAuth
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { User, AtSign, Mail, Lock, ArrowLeft, Check } from "lucide-react-native";
import Toast from "react-native-toast-message";
import { useAuthStore } from "../../stores/authStore";
import { signInWithGoogleNative } from "../../lib/googleAuth";
import { signupSchema } from "../../lib/validation";
import { GOOGLE_SIGN_IN_ENABLED } from "../../lib/releaseConfig";
import {
  GlassCard,
  GradientButton,
  GradientText,
  AnimatedListItem,
  GRADIENTS,
  GLASS,
} from "../../components/ui";

export default function SignupScreen() {
  const { signupWithEmail, loginWithGoogleIdToken } = useAuthStore();
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [acceptedPolicies, setAcceptedPolicies] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSignup = async () => {
    setErrors({});
    if (!acceptedPolicies) {
      setErrors({ policies: "Accept the policies to create an account." });
      return;
    }
    const result = signupSchema.safeParse({ name, username, email, password, confirmPassword });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) newErrors[err.path[0] as string] = err.message;
      });
      setErrors(newErrors);
      return;
    }
    setLoading(true);
    try {
      await signupWithEmail({
        name: name.trim(),
        username: username.trim(),
        email: email.trim(),
        password,
      });
      Toast.show({ type: "success", text1: "Welcome to eStories!" });
      router.replace("/");
    } catch (err) {
      console.error("[Signup] Email signup failed:", err);
      const message = err instanceof Error ? err.message : "Signup failed. Try again.";
      Toast.show({ type: "error", text1: message });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!acceptedPolicies) {
      setErrors({ policies: "Accept the policies to create an account." });
      return;
    }
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
      console.error("[Signup] Google login failed:", err);
      Toast.show({ type: "error", text1: "Google sign-in failed. Try again." });
    } finally {
      setGoogleLoading(false);
    }
  };

  const renderField = (
    icon: React.ReactNode,
    value: string,
    onChangeText: (t: string) => void,
    placeholder: string,
    errorKey: string,
    index: number,
    opts?: { secureTextEntry?: boolean; keyboardType?: string; autoCapitalize?: string; autoFocus?: boolean }
  ) => (
    <AnimatedListItem index={index}>
      <View>
        <GlassCard
          intensity="light"
          style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 }}
        >
          {icon}
          <TextInput
            value={value}
            onChangeText={(t) => { onChangeText(t); setErrors((e) => ({ ...e, [errorKey]: "" })); }}
            placeholder={placeholder}
            style={{ flex: 1, fontSize: 15, color: "#fff" }}
            placeholderTextColor="#64748b"
            secureTextEntry={opts?.secureTextEntry}
            keyboardType={opts?.keyboardType as any}
            autoCapitalize={opts?.autoCapitalize as any ?? "sentences"}
            autoCorrect={false}
            autoFocus={opts?.autoFocus}
          />
        </GlassCard>
        {errors[errorKey] ? (
          <Text style={{ marginTop: 4, marginLeft: 4, fontSize: 11, color: "#f87171" }}>
            {errors[errorKey]}
          </Text>
        ) : null}
      </View>
    </AnimatedListItem>
  );

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
            {/* Back button */}
            <View style={{ flexDirection: "row", paddingVertical: 16 }}>
              <TouchableOpacity onPress={() => router.back()}>
                <ArrowLeft size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* Header */}
            <AnimatedListItem index={0}>
              <View style={{ paddingBottom: 24 }}>
                <GradientText
                  text="Create Account"
                  gradient={GRADIENTS.primary}
                  style={{ fontSize: 28 }}
                />
                <Text style={{ marginTop: 8, fontSize: 15, color: "#94a3b8" }}>
                  Start capturing your stories
                </Text>
              </View>
            </AnimatedListItem>

            {/* Form */}
            <View style={{ gap: 12 }}>
              {renderField(
                <User size={20} color="#a78bfa" />,
                name, setName, "Full Name", "name", 1,
                { autoFocus: true }
              )}
              {renderField(
                <AtSign size={20} color="#a78bfa" />,
                username, setUsername, "Username", "username", 2,
                { autoCapitalize: "none" }
              )}
              {renderField(
                <Mail size={20} color="#a78bfa" />,
                email, setEmail, "Email", "email", 3,
                { keyboardType: "email-address", autoCapitalize: "none" }
              )}
              {renderField(
                <Lock size={20} color="#a78bfa" />,
                password, setPassword, "Password", "password", 4,
                { secureTextEntry: true }
              )}
              {renderField(
                <Lock size={20} color="#a78bfa" />,
                confirmPassword, setConfirmPassword, "Confirm Password", "confirmPassword", 5,
                { secureTextEntry: true }
              )}

              <AnimatedListItem index={6}>
                <View>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <TouchableOpacity
                      accessibilityRole="checkbox"
                      accessibilityLabel="Accept Terms, Privacy Policy, and Community Guidelines"
                      accessibilityState={{ checked: acceptedPolicies }}
                      onPress={() => {
                        setAcceptedPolicies((accepted) => !accepted);
                        setErrors((current) => ({ ...current, policies: "" }));
                      }}
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        width: 24,
                        height: 24,
                        marginTop: 1,
                        borderRadius: 6,
                        borderWidth: 1,
                        borderColor: acceptedPolicies ? "#8b5cf6" : "#64748b",
                        backgroundColor: acceptedPolicies ? "#7c3aed" : "transparent",
                      }}
                    >
                      {acceptedPolicies ? <Check size={16} color="#fff" /> : null}
                    </TouchableOpacity>
                    <Text style={{ flex: 1, fontSize: 12, lineHeight: 18, color: "#94a3b8" }}>
                      I agree to the{" "}
                      <Text
                        style={{ color: "#a78bfa", textDecorationLine: "underline" }}
                        onPress={() => Linking.openURL("https://estories.app/terms")}
                      >
                        Terms of Service
                      </Text>
                      {", "}
                      <Text
                        style={{ color: "#a78bfa", textDecorationLine: "underline" }}
                        onPress={() => Linking.openURL("https://estories.app/privacy")}
                      >
                        Privacy Policy
                      </Text>
                      {", and "}
                      <Text
                        style={{ color: "#a78bfa", textDecorationLine: "underline" }}
                        onPress={() => Linking.openURL("https://estories.app/community-guidelines")}
                      >
                        Community Guidelines
                      </Text>
                      .
                    </Text>
                  </View>
                  {errors.policies ? (
                    <Text style={{ marginTop: 6, marginLeft: 34, fontSize: 11, color: "#f87171" }}>
                      {errors.policies}
                    </Text>
                  ) : null}
                </View>
              </AnimatedListItem>

              {/* Create Account button */}
              <AnimatedListItem index={7}>
                <View style={{ marginTop: 8 }}>
                  <GradientButton
                    onPress={handleSignup}
                    title="Create Account"
                    gradient={GRADIENTS.primary}
                    size="lg"
                    loading={loading}
                    disabled={loading || !acceptedPolicies}
                    fullWidth
                  />
                </View>
              </AnimatedListItem>
            </View>

            {GOOGLE_SIGN_IN_ENABLED ? (
              <>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 20 }}>
                  <View style={{ height: 1, flex: 1, backgroundColor: GLASS.light.border }} />
                  <Text style={{ fontSize: 13, color: "#64748b" }}>or</Text>
                  <View style={{ height: 1, flex: 1, backgroundColor: GLASS.light.border }} />
                </View>

                <GlassCard intensity="medium" style={{ overflow: "hidden" }}>
                  <TouchableOpacity
                    onPress={handleGoogleLogin}
                    disabled={googleLoading || !acceptedPolicies}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 12,
                      paddingVertical: 16,
                      opacity: googleLoading || !acceptedPolicies ? 0.5 : 1,
                    }}
                  >
                    <Text style={{ fontSize: 16, fontWeight: "600", color: "#fff" }}>
                      {googleLoading ? "Signing in..." : "Continue with Google"}
                    </Text>
                  </TouchableOpacity>
                </GlassCard>
              </>
            ) : null}

            {/* Sign In link */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 32, paddingBottom: 8 }}>
              <Text style={{ fontSize: 13, color: "#94a3b8" }}>Already have an account?</Text>
              <TouchableOpacity onPress={() => router.back()}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#a78bfa" }}>Sign In</Text>
              </TouchableOpacity>
            </View>

            <View style={{ height: 16 }} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
