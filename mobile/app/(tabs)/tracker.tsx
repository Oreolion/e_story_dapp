// Tracker Screen - Daily habit/mood tracking with AI journal generation
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import {
  CalendarCheck,
  Plus,
  Trash2,
  Check,
  Circle,
  Sparkles,
  Flame,
} from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useAuthStore } from "../../stores/authStore";
import { apiGet, apiPost, apiPut, apiDelete } from "../../lib/api";
import type { Habit, DailyLog } from "../../types";
import {
  GlassCard,
  GradientButton,
  AnimatedListItem,
  SectionHeader,
  SkeletonLoader,
  GRADIENTS,
  ANIMATION,
} from "../../components/ui";

const MOODS = [
  { label: "Great", value: "great", emoji: "😊", color: "#4ade80" },
  { label: "Good", value: "good", emoji: "🙂", color: "#60a5fa" },
  { label: "Okay", value: "okay", emoji: "😐", color: "#facc15" },
  { label: "Tough", value: "tough", emoji: "😞", color: "#f87171" },
];

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function MoodButton({ mood, isSelected, onPress }: {
  mood: typeof MOODS[number];
  isSelected: boolean;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(1.1, {
      damping: ANIMATION.springConfig.damping,
      stiffness: ANIMATION.springConfig.stiffness,
    });
    setTimeout(() => {
      scale.value = withSpring(1, {
        damping: ANIMATION.springConfig.damping,
        stiffness: ANIMATION.springConfig.stiffness,
      });
    }, 150);
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.8}
      style={{ flex: 1 }}
    >
      <Animated.View style={animatedStyle}>
        <GlassCard
          intensity={isSelected ? "heavy" : "light"}
          style={{
            alignItems: "center",
            paddingVertical: 12,
            ...(isSelected && {
              backgroundColor: mood.color + "20",
              borderColor: mood.color,
              borderWidth: 1.5,
            }),
          }}
        >
          <Text style={{ fontSize: 20 }}>{mood.emoji}</Text>
          <Text
            style={{
              marginTop: 4,
              fontSize: 11,
              fontWeight: "600",
              color: isSelected ? "#fff" : "#94a3b8",
            }}
          >
            {mood.label}
          </Text>
        </GlassCard>
      </Animated.View>
    </TouchableOpacity>
  );
}

export default function TrackerScreen() {
  const { isAuthenticated, user } = useAuthStore();
  const [habits, setHabits] = useState<Habit[]>([]);
  const [dailyLog, setDailyLog] = useState<DailyLog | null>(null);
  const [newHabitTitle, setNewHabitTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMood, setSelectedMood] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generatingJournal, setGeneratingJournal] = useState(false);
  const [streak, setStreak] = useState(0);

  const today = formatDate(new Date());

  const fetchData = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    try {
      const res = await apiGet<{
        habits: Habit[];
        dailyLog: DailyLog | null;
        streak?: number;
        recentLogs?: DailyLog[];
      }>(`/api/habits?user_id=${user.id}&date=${today}`);
      if (res.ok && res.data) {
        setHabits(res.data.habits || []);
        if (res.data.dailyLog) {
          setDailyLog(res.data.dailyLog);
          setSelectedMood(res.data.dailyLog.mood || "");
          setNotes(res.data.dailyLog.notes || "");
        }
        // Calculate streak from recent logs or use server-provided value
        if (res.data.streak !== undefined) {
          setStreak(res.data.streak);
        } else if (res.data.recentLogs) {
          let s = 0;
          const d = new Date();
          for (const log of res.data.recentLogs) {
            const logDate = formatDate(new Date(log.date));
            const expected = formatDate(d);
            if (logDate === expected && log.completed_habit_ids.length > 0) {
              s++;
              d.setDate(d.getDate() - 1);
            } else {
              break;
            }
          }
          setStreak(s);
        }
      }
    } catch (err) {
      console.error("[Tracker] Fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user, today]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const completedIds = dailyLog?.completed_habit_ids || [];
  const completedCount = completedIds.length;
  const totalHabits = habits.length;
  const progressPercent = totalHabits > 0 ? (completedCount / totalHabits) * 100 : 0;

  const saveDailyLog = async (updates: Partial<DailyLog>) => {
    const payload = {
      user_id: user!.id,
      date: today,
      completed_habit_ids: completedIds,
      mood: selectedMood,
      notes,
      ...updates,
    };
    const res = await apiPut<{ dailyLog: DailyLog }>("/api/habits", payload);
    if (res.ok && res.data?.dailyLog) {
      setDailyLog(res.data.dailyLog);
    }
  };

  const toggleHabit = async (habitId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const isCompleted = completedIds.includes(habitId);
    const newIds = isCompleted
      ? completedIds.filter((id) => id !== habitId)
      : [...completedIds, habitId];
    setDailyLog((prev) =>
      prev
        ? { ...prev, completed_habit_ids: newIds }
        : { user_id: user!.id, date: today, completed_habit_ids: newIds, mood: selectedMood, notes }
    );
    await saveDailyLog({ completed_habit_ids: newIds });
  };

  const addHabit = async () => {
    if (!newHabitTitle.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const res = await apiPost<{ habit: Habit }>("/api/habits", {
      user_id: user!.id,
      title: newHabitTitle.trim(),
      category: "general",
      target_frequency: "daily",
    });
    if (res.ok && res.data?.habit) {
      setHabits((prev) => [...prev, res.data!.habit]);
      setNewHabitTitle("");
    }
  };

  const deleteHabit = (habit: Habit) => {
    Alert.alert("Delete Habit", `Remove "${habit.title}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          const res = await apiDelete(`/api/habits?id=${habit.id}`);
          if (res.ok) {
            setHabits((prev) => prev.filter((h) => h.id !== habit.id));
          }
        },
      },
    ]);
  };

  const selectMood = async (mood: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedMood(mood);
    await saveDailyLog({ mood });
  };

  const saveNotes = async () => {
    await saveDailyLog({ notes });
  };

  const generateJournal = async () => {
    if (!user) return;
    setGeneratingJournal(true);
    try {
      const completedHabits = habits
        .filter((h) => completedIds.includes(h.id))
        .map((h) => h.title);
      const prompt = [
        selectedMood && `Today I felt ${selectedMood}.`,
        completedHabits.length > 0 &&
          `I completed these habits: ${completedHabits.join(", ")}.`,
        notes && `Notes: ${notes}`,
      ]
        .filter(Boolean)
        .join(" ");

      if (!prompt) {
        Alert.alert("Add some data first", "Select a mood or complete some habits before generating a journal.");
        return;
      }

      const enhanceRes = await apiPost<{ text: string }>("/api/ai/enhance", {
        text: prompt,
        task: "tracker",
      });
      if (enhanceRes.ok && enhanceRes.data?.text) {
        const saveRes = await apiPost("/api/journal/save", {
          content: enhanceRes.data.text,
          source: "tracker",
          mood: selectedMood,
          date: today,
        });
        if (saveRes.ok) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Alert.alert("Journal Created", "Your AI journal entry has been saved!");
        }
      }
    } catch (err) {
      console.error("[Tracker] Journal generation failed:", err);
      Alert.alert("Error", "Failed to generate journal entry.");
    } finally {
      setGeneratingJournal(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}>
        <GlassCard intensity="medium" style={{ padding: 32, alignItems: "center", marginHorizontal: 24 }}>
          <CalendarCheck size={48} color="#64748b" />
          <Text style={{ marginTop: 16, fontSize: 17, color: "#94a3b8" }}>Sign in to track your habits</Text>
          <View style={{ marginTop: 16 }}>
            <GradientButton
              onPress={() => router.push("/auth/login")}
              title="Sign In"
              gradient={GRADIENTS.primary}
            />
          </View>
        </GlassCard>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <AnimatedListItem index={0}>
          <View style={{ paddingHorizontal: 16, paddingVertical: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View>
                <Text style={{ fontSize: 24, fontWeight: "700", color: "#fff" }}>Daily Tracker</Text>
                <Text style={{ fontSize: 13, color: "#94a3b8" }}>
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </Text>
              </View>
              {streak > 0 && (
                <View style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  backgroundColor: "rgba(251,146,60,0.15)",
                  borderWidth: 1,
                  borderColor: "rgba(251,146,60,0.3)",
                }}>
                  <Flame size={16} color="#fb923c" />
                  <Text style={{ fontSize: 14, fontWeight: "700", color: "#fb923c" }}>{streak}</Text>
                  <Text style={{ fontSize: 11, color: "#fb923c" }}>day streak</Text>
                </View>
              )}
            </View>
          </View>
        </AnimatedListItem>

        {/* Progress Card */}
        <AnimatedListItem index={1}>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <GlassCard intensity="medium" style={{ padding: 16 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "500", color: "#cbd5e1" }}>Today's Progress</Text>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#34d399" }}>
                  {completedCount}/{totalHabits}
                </Text>
              </View>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <LinearGradient
                  colors={GRADIENTS.success}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{ height: 8, borderRadius: 4, width: `${progressPercent}%` }}
                />
              </View>
              {totalHabits > 0 && progressPercent === 100 && (
                <Text style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "#34d399" }}>
                  All habits completed! Great job!
                </Text>
              )}
            </GlassCard>
          </View>
        </AnimatedListItem>

        {/* Mood Selector */}
        <AnimatedListItem index={2}>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader title="How are you feeling?" />
            <View style={{ flexDirection: "row", gap: 8 }}>
              {MOODS.map((mood) => (
                <MoodButton
                  key={mood.value}
                  mood={mood}
                  isSelected={selectedMood === mood.value}
                  onPress={() => selectMood(mood.value)}
                />
              ))}
            </View>
          </View>
        </AnimatedListItem>

        {/* Habits List */}
        <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
          <SectionHeader title="Habits" />
          {loading ? (
            <SkeletonLoader variant="line" count={3} />
          ) : (
            <>
              {habits.map((habit, idx) => {
                const isCompleted = completedIds.includes(habit.id);
                return (
                  <AnimatedListItem key={habit.id} index={idx + 3}>
                    <TouchableOpacity
                      onPress={() => toggleHabit(habit.id)}
                      onLongPress={() => deleteHabit(habit)}
                      activeOpacity={0.8}
                    >
                      <GlassCard
                        intensity="light"
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          padding: 14,
                          marginBottom: 8,
                        }}
                      >
                        {isCompleted ? (
                          <View
                            style={{
                              marginRight: 12,
                              width: 24,
                              height: 24,
                              borderRadius: 12,
                              backgroundColor: "#10b981",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Check size={14} color="#fff" />
                          </View>
                        ) : (
                          <View style={{ marginRight: 12 }}>
                            <Circle size={24} color="#64748b" />
                          </View>
                        )}
                        <Text
                          style={{
                            flex: 1,
                            fontSize: 15,
                            color: isCompleted ? "#64748b" : "#fff",
                            textDecorationLine: isCompleted ? "line-through" : "none",
                          }}
                        >
                          {habit.title}
                        </Text>
                        <TouchableOpacity
                          onPress={() => deleteHabit(habit)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Trash2 size={16} color="#64748b" />
                        </TouchableOpacity>
                      </GlassCard>
                    </TouchableOpacity>
                  </AnimatedListItem>
                );
              })}

              {/* Add Habit Row */}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <GlassCard
                  intensity="light"
                  style={{ flex: 1, padding: 0 }}
                >
                  <TextInput
                    value={newHabitTitle}
                    onChangeText={setNewHabitTitle}
                    placeholder="Add a habit..."
                    placeholderTextColor="#64748b"
                    style={{ paddingHorizontal: 16, paddingVertical: 12, fontSize: 15, color: "#fff" }}
                    onSubmitEditing={addHabit}
                    returnKeyType="done"
                  />
                </GlassCard>
                <GradientButton
                  onPress={addHabit}
                  title=""
                  icon={<Plus size={20} color="#fff" />}
                  gradient={GRADIENTS.primary}
                  size="sm"
                  style={{ width: 48, height: 48 }}
                />
              </View>
            </>
          )}
        </View>

        {/* Daily Notes */}
        <AnimatedListItem index={5}>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <SectionHeader title="Notes" />
            <GlassCard intensity="light" style={{ padding: 0 }}>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                onBlur={saveNotes}
                placeholder="How was your day? Any reflections..."
                placeholderTextColor="#64748b"
                style={{ minHeight: 100, padding: 16, fontSize: 15, color: "#fff", textAlignVertical: "top" }}
                multiline
              />
            </GlassCard>
          </View>
        </AnimatedListItem>

        {/* AI Journal Button */}
        <AnimatedListItem index={6}>
          <View style={{ marginHorizontal: 16, marginBottom: 16 }}>
            <GradientButton
              onPress={generateJournal}
              title={generatingJournal ? "Generating..." : "Generate AI Journal"}
              icon={<Sparkles size={20} color="#fff" />}
              gradient={GRADIENTS.accent}
              loading={generatingJournal}
              disabled={generatingJournal}
              size="lg"
              fullWidth
            />
          </View>
        </AnimatedListItem>
      </ScrollView>
    </SafeAreaView>
  );
}
