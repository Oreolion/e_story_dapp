// Home Screen - Hero, quick actions, stats, token balance
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { Mic, BookOpen, Users, TrendingUp, Wallet, Flame, Bell } from "lucide-react-native";
import { useAccount } from "wagmi";
import { useAuthStore } from "../../stores/authStore";
import { apiGet } from "../../lib/api";
import { WEB3_FEATURES_ENABLED } from "../../lib/releaseConfig";
import {
  GlassCard,
  GradientButton,
  GradientText,
  AnimatedListItem,
  StatCard,
  SkeletonLoader,
  GRADIENTS,
} from "../../components/ui";

export default function HomeScreen() {
  const { user, isAuthenticated } = useAuthStore();
  const { address, isConnected } = useAccount();
  const [stats, setStats] = useState({ stories: 0, books: 0, streak: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    try {
      const [profileRes, booksRes] = await Promise.all([
        apiGet<{ user: { stories_count?: number } }>("/api/user/profile"),
        apiGet<{ books?: { length?: number }; count?: number }>("/api/books"),
      ]);
      setStats((prev) => ({
        ...prev,
        stories: profileRes.data?.user?.stories_count || 0,
        books: (booksRes.data as any)?.books?.length || (booksRes.data as any)?.count || 0,
      }));
    } catch {} finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchStats();
  }, [isAuthenticated]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Hero Section with gradient overlay */}
        <LinearGradient
          colors={GRADIENTS.hero}
          style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 32 }}
        >
          <AnimatedListItem index={0}>
            <GradientText
              text={user?.name ? `Welcome, ${user.name}` : "Welcome to eStories"}
              gradient={GRADIENTS.primary}
              style={{ fontSize: 28, lineHeight: 36 }}
            />
          </AnimatedListItem>
          <AnimatedListItem index={1}>
            <Text style={{ marginTop: 6, fontSize: 15, color: "#94a3b8" }}>
              Write about anything you're passionate about. AI-powered insights, blockchain provenance, and privacy by default.
            </Text>
          </AnimatedListItem>
        </LinearGradient>

        <View style={{ paddingHorizontal: 16 }}>
          {/* Quick Actions */}
          <AnimatedListItem index={2}>
            <View style={{ flexDirection: "row", gap: 12, marginTop: -16 }}>
              <View style={{ flex: 1 }}>
                <GradientButton
                  onPress={() => router.push("/record")}
                  title="Record"
                  gradient={GRADIENTS.recording}
                  icon={<Mic size={22} color="#fff" />}
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <GlassCard
                  intensity="medium"
                  style={{
                    padding: 14,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <BookOpen
                    size={22}
                    color="#a78bfa"
                    onPress={() => router.push("/library")}
                  />
                  <Text style={{ marginTop: 8, fontWeight: "600", color: "#cbd5e1", fontSize: 13 }}>
                    Archive
                  </Text>
                </GlassCard>
              </View>
              <View style={{ flex: 1 }}>
                <GlassCard
                  intensity="medium"
                  style={{
                    padding: 14,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users
                    size={22}
                    color="#a78bfa"
                    onPress={() => router.push("/social")}
                  />
                  <Text style={{ marginTop: 8, fontWeight: "600", color: "#cbd5e1", fontSize: 13 }}>
                    Community
                  </Text>
                </GlassCard>
              </View>
            </View>
          </AnimatedListItem>

          {/* Stats Cards */}
          {isAuthenticated && (
            <AnimatedListItem index={3}>
              <View style={{ marginTop: 20, flexDirection: "row", gap: 12 }}>
                {loading ? (
                  <SkeletonLoader variant="card" height={80} />
                ) : (
                  <>
                    <StatCard value={stats.stories} label="Stories" color="#fff" />
                    <StatCard value={stats.books} label="Books" color="#fff" />
                    <StatCard
                      value={stats.streak}
                      label="Streak"
                      color="#fb923c"
                      icon={<Flame size={18} color="#fb923c" />}
                    />
                  </>
                )}
              </View>
            </AnimatedListItem>
          )}

          {/* Wallet Status */}
          {WEB3_FEATURES_ENABLED && isConnected && address && (
            <AnimatedListItem index={4}>
              <GlassCard
                intensity="light"
                style={{ marginTop: 16, padding: 16 }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <LinearGradient
                    colors={GRADIENTS.accent}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ width: 3, height: 32, borderRadius: 2 }}
                  />
                  <View>
                    <Text style={{ fontSize: 12, color: "#94a3b8" }}>Connected Wallet</Text>
                    <Text style={{ marginTop: 2, fontFamily: "monospace", fontSize: 12, color: "#a78bfa" }}>
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </Text>
                  </View>
                </View>
              </GlassCard>
            </AnimatedListItem>
          )}

          {/* Login CTA */}
          {!isAuthenticated && (
            <AnimatedListItem index={3}>
              <GlassCard
                intensity="medium"
                style={{ marginTop: 32, padding: 24, alignItems: "center" }}
              >
                <Text style={{ fontSize: 18, fontWeight: "600", color: "#fff" }}>
                  Start your journey
                </Text>
                <Text
                  style={{
                    marginTop: 8,
                    textAlign: "center",
                    fontSize: 14,
                    color: "#94a3b8",
                    lineHeight: 20,
                  }}
                >
                  {WEB3_FEATURES_ENABLED
                    ? "Connect your wallet or sign in to start writing stories."
                    : "Sign in or create an account to start writing stories."}
                </Text>
                <View style={{ marginTop: 16, width: "100%" }}>
                  <GradientButton
                    onPress={() => router.push("/auth/login")}
                    title="Get Started"
                    gradient={GRADIENTS.primary}
                    size="lg"
                    fullWidth
                  />
                </View>
              </GlassCard>
            </AnimatedListItem>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
