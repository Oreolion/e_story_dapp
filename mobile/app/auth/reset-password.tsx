import React, { useEffect, useState } from "react";
import { Text, TextInput, View } from "react-native";
import * as Linking from "expo-linking";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";
import { Lock } from "lucide-react-native";

import { supabase } from "../../lib/supabase";
import { GlassCard, GradientButton, GradientText, GRADIENTS } from "../../components/ui";

async function establishRecoverySession(url: string) {
  const parsed = Linking.parse(url);
  const code = typeof parsed.queryParams?.code === "string" ? parsed.queryParams.code : null;
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return;
  }

  const fragment = url.includes("#") ? url.slice(url.indexOf("#") + 1) : "";
  const params = new URLSearchParams(fragment);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (error) throw error;
  }
}

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    Linking.getInitialURL()
      .then(async (url) => {
        if (url) await establishRecoverySession(url);
        if (mounted) setReady(true);
      })
      .catch(() => {
        if (mounted) {
          Toast.show({ type: "error", text1: "This recovery link is invalid or expired" });
        }
      });
    return () => {
      mounted = false;
    };
  }, []);

  const updatePassword = async () => {
    if (password.length < 12) {
      Toast.show({ type: "error", text1: "Use at least 12 characters" });
      return;
    }
    if (password !== confirmation) {
      Toast.show({ type: "error", text1: "Passwords do not match" });
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Toast.show({ type: "error", text1: "Unable to update password" });
      return;
    }

    Toast.show({ type: "success", text1: "Password updated" });
    router.replace("/auth/login");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a", padding: 24 }}>
      <View style={{ paddingVertical: 36 }}>
        <GradientText text="Choose a new password" gradient={GRADIENTS.primary} style={{ fontSize: 28 }} />
        <Text style={{ color: "#94a3b8", marginTop: 10, lineHeight: 20 }}>
          Use a unique password with at least 12 characters.
        </Text>
      </View>

      <View style={{ gap: 14 }}>
        <GlassCard intensity="light" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
          <Lock size={19} color="#a78bfa" />
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="New password"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            accessibilityLabel="New password"
            style={{ flex: 1, minHeight: 48, color: "#fff", paddingHorizontal: 12 }}
          />
        </GlassCard>
        <GlassCard intensity="light" style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14 }}>
          <Lock size={19} color="#a78bfa" />
          <TextInput
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder="Confirm new password"
            placeholderTextColor="#64748b"
            secureTextEntry
            autoCapitalize="none"
            textContentType="newPassword"
            accessibilityLabel="Confirm new password"
            style={{ flex: 1, minHeight: 48, color: "#fff", paddingHorizontal: 12 }}
          />
        </GlassCard>
        <GradientButton
          onPress={updatePassword}
          title={loading ? "Updating..." : "Update Password"}
          gradient={GRADIENTS.primary}
          loading={loading}
          disabled={!ready || loading}
          fullWidth
        />
      </View>
    </SafeAreaView>
  );
}
