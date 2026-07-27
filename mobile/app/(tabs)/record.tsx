// Record Screen - Audio capture, transcription, enhancement, save
// Supports both voice recording and typed stories
import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from "react-native-reanimated";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import * as Speech from "expo-speech";
import * as Crypto from "expo-crypto";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import {
  Mic,
  Square,
  Play,
  Pause,
  Sparkles,
  Save,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Undo2,
  PenLine,
  Calendar,
  Lightbulb,
  Clock,
} from "lucide-react-native";
import Toast from "react-native-toast-message";
import { router } from "expo-router";
import { useAuthStore } from "../../stores/authStore";
import { api, apiUpload } from "../../lib/api";
import { getRecordDraftKey } from "../../lib/userData";
import { buildJournalSaveBody } from "../../lib/storySave";
import { storySchema } from "../../lib/validation";
import {
  GlassCard,
  GradientButton,
  Badge,
  AnimatedListItem,
  GRADIENTS,
} from "../../components/ui";

type RecordingStep = "idle" | "recording" | "recorded" | "transcribing" | "enhancing" | "saving";
type InputMode = "voice" | "write";

const MOODS = [
  "peaceful", "inspiring", "adventurous", "nostalgic",
  "thoughtful", "exciting", "neutral",
];

const RECORDING_TIPS = [
  { num: "1", text: "Speak clearly and at a moderate pace" },
  { num: "2", text: "Find a quiet environment for best results" },
  { num: "3", text: "You can edit the text after transcription" },
  { num: "4", text: "Stories are saved securely to the cloud" },
];

function getTodayString(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDisplayDate(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}

export default function RecordScreen() {
  const { isAuthenticated, user } = useAuthStore();
  const [inputMode, setInputMode] = useState<InputMode>("voice");
  const [step, setStep] = useState<RecordingStep>("idle");
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [enhancedText, setEnhancedText] = useState("");
  const [preEnhanceText, setPreEnhanceText] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [selectedMood, setSelectedMood] = useState("neutral");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [storyDate, setStoryDate] = useState(getTodayString());
  const [duration, setDuration] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [parentStoryId, setParentStoryId] = useState<string | null>(null);
  const [saveRequestKey, setSaveRequestKey] = useState(() =>
    Crypto.randomUUID()
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const activeOwnerRef = useRef(user?.id ?? null);

  useEffect(() => {
    recordingRef.current = recording;
  }, [recording]);

  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);

  const releaseMedia = useCallback(() => {
    const activeRecording = recordingRef.current;
    const activeSound = soundRef.current;
    recordingRef.current = null;
    soundRef.current = null;

    if (activeRecording) {
      void activeRecording.stopAndUnloadAsync().catch(() => {});
    }
    if (activeSound) {
      void activeSound.unloadAsync().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const ownerId = user?.id ?? null;
    if (activeOwnerRef.current && activeOwnerRef.current !== ownerId) {
      releaseMedia();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecording(null);
      setSound(null);
    }
    activeOwnerRef.current = ownerId;
  }, [releaseMedia, user?.id]);

  const isBusy = step === "transcribing" || step === "enhancing" || step === "saving";
  const hasContent = !!(enhancedText || transcript);

  // === Draft Persistence ===
  const draftKey = user?.id ? getRecordDraftKey(user.id) : null;

  const saveDraft = useCallback(async () => {
    if (!draftKey || (!title && !transcript && !enhancedText && !tags)) return;
    try {
      await AsyncStorage.setItem(
        draftKey,
        JSON.stringify({
          title,
          transcript,
          enhancedText,
          tags,
          selectedMood,
          isPublic,
          storyDate,
          inputMode,
          parentStoryId,
          saveRequestKey,
        })
      );
    } catch {}
  }, [draftKey, title, transcript, enhancedText, tags, selectedMood, isPublic, storyDate, inputMode, parentStoryId, saveRequestKey]);

  const loadDraft = useCallback(async () => {
    if (!draftKey) return;

    // Clear in-memory editor state before loading the next owner's draft.
    // Scoped storage alone is insufficient if the screen remains mounted
    // through an account switch.
    releaseMedia();
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setStep("idle");
    setRecording(null);
    setRecordingUri(null);
    setSound(null);
    setTranscript("");
    setEnhancedText("");
    setPreEnhanceText(null);
    setTitle("");
    setTags("");
    setSelectedMood("neutral");
    setIsPublic(false);
    setStoryDate(getTodayString());
    setInputMode("voice");
    setParentStoryId(null);
    setFieldErrors({});
    setDuration(0);
    setIsSpeaking(false);
    setSaveRequestKey(Crypto.randomUUID());
    Speech.stop();

    try {
      const raw = await AsyncStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.title) setTitle(draft.title);
      if (draft.transcript) setTranscript(draft.transcript);
      if (draft.enhancedText) setEnhancedText(draft.enhancedText);
      if (draft.tags) setTags(draft.tags);
      if (draft.selectedMood) setSelectedMood(draft.selectedMood);
      if (draft.isPublic !== undefined) setIsPublic(draft.isPublic);
      if (draft.storyDate) setStoryDate(draft.storyDate);
      if (draft.inputMode) setInputMode(draft.inputMode);
      if (draft.parentStoryId) setParentStoryId(draft.parentStoryId);
      if (
        typeof draft.saveRequestKey === "string" &&
        /^[A-Za-z0-9._:-]{16,128}$/.test(draft.saveRequestKey)
      ) {
        setSaveRequestKey(draft.saveRequestKey);
      } else {
        setSaveRequestKey(Crypto.randomUUID());
      }
      if (draft.title || draft.transcript || draft.enhancedText) {
        setStep("recorded");
        Toast.show({ type: "info", text1: "Draft restored", text2: "Your previous entry was recovered" });
      }
    } catch {}
  }, [draftKey, releaseMedia]);

  const clearDraft = useCallback(async () => {
    if (!draftKey) return;
    try { await AsyncStorage.removeItem(draftKey); } catch {}
  }, [draftKey]);

  // Load draft on mount
  useEffect(() => { loadDraft(); }, [loadDraft]);

  // Auto-save draft on content changes (debounced)
  useEffect(() => {
    const timer = setTimeout(saveDraft, 2000);
    return () => clearTimeout(timer);
  }, [title, transcript, enhancedText, tags, selectedMood, isPublic, storyDate, saveDraft]);

  // Reanimated pulse animations
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.4);

  useEffect(() => {
    if (step === "recording") {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.25, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.8, { duration: 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.4, { duration: 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 300 });
      pulseOpacity.value = withTiming(0.4, { duration: 300 });
    }
  }, [step]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      Speech.stop();
      releaseMedia();
    };
  }, [releaseMedia]);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a", alignItems: "center", justifyContent: "center" }}>
        <GlassCard intensity="medium" style={{ padding: 32, alignItems: "center", marginHorizontal: 24 }}>
          <Mic size={48} color="#64748b" />
          <Text style={{ marginTop: 16, fontSize: 17, color: "#94a3b8" }}>Sign in to record</Text>
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

  const startRecording = async () => {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission required", "Microphone access is needed to record.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(newRecording);
      setStep("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("[Record] Start failed:", err);
      Toast.show({ type: "error", text1: "Recording failed to start" });
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);
      setRecording(null);
      setStep("recorded");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (err) {
      console.error("[Record] Stop failed:", err);
    }
  };

  const playRecording = async () => {
    if (!recordingUri) return;
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        return;
      }
      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: recordingUri },
        { shouldPlay: true }
      );
      setSound(newSound);
      setIsPlaying(true);
      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (err) {
      console.error("[Record] Play failed:", err);
    }
  };

  const transcribe = async () => {
    if (!recordingUri) return;
    setStep("transcribing");
    try {
      const formData = new FormData();
      formData.append("file", {
        uri: recordingUri,
        type: "audio/m4a",
        name: "recording.m4a",
      } as unknown as Blob);

      const res = await apiUpload<{ text: string }>("/api/ai/transcribe", formData);
      if (res.ok && res.data?.text) {
        setTranscript(res.data.text);
        // Auto-generate title on first transcription
        if (!title) {
          setTitle(`Story Entry - ${formatDisplayDate(storyDate)}`);
        }
        setStep("recorded");
        Toast.show({ type: "success", text1: "Transcription complete!" });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.error("[Record] Transcribe failed:", err);
      Toast.show({ type: "error", text1: "Transcription failed" });
      setStep("recorded");
    }
  };

  const enhance = async () => {
    const text = enhancedText || transcript;
    if (!text) return;
    setStep("enhancing");
    try {
      const res = await api<{ text: string }>("/api/ai/enhance", {
        method: "POST",
        body: { text },
      });
      if (res.ok && res.data?.text) {
        setPreEnhanceText(text);
        setEnhancedText(res.data.text);
        setStep("recorded");
        Toast.show({ type: "success", text1: "Story enhanced!" });
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.error("[Record] Enhance failed:", err);
      Toast.show({ type: "error", text1: "Enhancement failed" });
      setStep("recorded");
    }
  };

  const revertEnhancement = () => {
    if (preEnhanceText) {
      setEnhancedText("");
      setTranscript(preEnhanceText);
      setPreEnhanceText(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const toggleReadAloud = async () => {
    const text = enhancedText || transcript;
    if (!text) return;

    if (isSpeaking) {
      Speech.stop();
      setIsSpeaking(false);
      return;
    }

    setIsSpeaking(true);
    Speech.speak(text, {
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      rate: 0.9,
    });
  };

  const saveStory = async () => {
    setFieldErrors({});
    const content = enhancedText || transcript;
    const result = storySchema.safeParse({
      title: title.trim(),
      content: content.trim(),
      mood: selectedMood,
      tags,
      isPublic,
      storyDate,
    });
    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        if (err.path[0]) errors[err.path[0] as string] = err.message;
      });
      setFieldErrors(errors);
      Toast.show({ type: "error", text1: "Please fix the errors before saving" });
      return;
    }

    const ownerId = user?.id;
    if (!ownerId) {
      Toast.show({
        type: "error",
        text1: "Sign in again before saving",
      });
      return;
    }

    setStep("saving");
    try {
      // Upload audio file if recording exists
      let audioUrl: string | undefined;
      if (recordingUri) {
        try {
          const formData = new FormData();
          formData.append("file", {
            uri: recordingUri,
            type: "audio/m4a",
            name: "recording.m4a",
          } as unknown as Blob);
          formData.append("userId", ownerId);
          const uploadRes = await apiUpload<{ success: boolean; url: string; path: string }>(
            "/api/audio/upload",
            formData
          );
          if (uploadRes.ok && uploadRes.data?.url) {
            audioUrl = uploadRes.data.url;
          } else {
            console.warn("[Record] Audio upload failed, saving without audio:", uploadRes.error);
            Toast.show({ type: "info", text1: "Audio upload failed", text2: "Story will be saved without audio" });
          }
        } catch (uploadErr) {
          console.warn("[Record] Audio upload error, saving without audio:", uploadErr);
          Toast.show({ type: "info", text1: "Audio upload failed", text2: "Story will be saved without audio" });
        }
      }

      if (useAuthStore.getState().user?.id !== ownerId) {
        throw new Error("Active account changed while saving");
      }

      const res = await api("/api/journal/save", {
        method: "POST",
        body: buildJournalSaveBody({
          title,
          content,
          mood: selectedMood,
          tags,
          isPublic,
          storyDate,
          audioUrl,
          parentStoryId,
        }),
        offlineQueue: {
          ownerId,
          idempotencyKey: saveRequestKey,
        },
      });

      if (res.ok || res.queued) {
        Toast.show(
          res.queued
            ? {
                type: "info",
                text1: "Story queued",
                text2: "It will sync automatically when you're back online.",
              }
            : { type: "success", text1: "Story saved!" }
        );
        await clearDraft();
        // Reset all state
        setStep("idle");
        setRecordingUri(null);
        setSound(null);
        setTranscript("");
        setEnhancedText("");
        setPreEnhanceText(null);
        setTitle("");
        setTags("");
        setSelectedMood("neutral");
        setIsPublic(false);
        setStoryDate(getTodayString());
        setParentStoryId(null);
        setSaveRequestKey(Crypto.randomUUID());
        setDuration(0);
        setIsSpeaking(false);
        Speech.stop();
        router.push("/library");
      } else {
        throw new Error(res.error);
      }
    } catch (err) {
      console.error("[Record] Save failed:", err);
      Toast.show({ type: "error", text1: "Failed to save story" });
      setStep("recorded");
    }
  };

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const resetForm = () => {
    setStep("idle");
    setRecordingUri(null);
    setSound(null);
    setTranscript("");
    setEnhancedText("");
    setPreEnhanceText(null);
    setTitle("");
    setTags("");
    setSelectedMood("neutral");
    setIsPublic(false);
    setStoryDate(getTodayString());
    setParentStoryId(null);
    setSaveRequestKey(Crypto.randomUUID());
    setDuration(0);
    setIsSpeaking(false);
    Speech.stop();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <AnimatedListItem index={0}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 24 }}>
            <Text style={{ fontSize: 24, fontWeight: "700", color: "#fff" }}>
              {inputMode === "voice" ? "Record Story" : "Write Story"}
            </Text>
            {/* Mode Toggle */}
            <View style={{ flexDirection: "row", gap: 4 }}>
              <TouchableOpacity
                onPress={() => {
                  setInputMode("voice");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <GlassCard
                  intensity={inputMode === "voice" ? "heavy" : "light"}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    ...(inputMode === "voice" && { borderColor: "rgba(99,102,241,0.5)", borderWidth: 1 }),
                  }}
                >
                  <Mic size={16} color={inputMode === "voice" ? "#818cf8" : "#64748b"} />
                </GlassCard>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setInputMode("write");
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                activeOpacity={0.8}
              >
                <GlassCard
                  intensity={inputMode === "write" ? "heavy" : "light"}
                  style={{
                    paddingHorizontal: 14,
                    paddingVertical: 8,
                    ...(inputMode === "write" && { borderColor: "rgba(99,102,241,0.5)", borderWidth: 1 }),
                  }}
                >
                  <PenLine size={16} color={inputMode === "write" ? "#818cf8" : "#64748b"} />
                </GlassCard>
              </TouchableOpacity>
            </View>
          </View>
        </AnimatedListItem>

        {/* === VOICE MODE: Recording Controls === */}
        {inputMode === "voice" && (
          <>
            <AnimatedListItem index={1}>
              <GlassCard intensity="medium" style={{ padding: 32, alignItems: "center" }}>
                {/* Recording Status Badge */}
                {step === "recording" && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
                    <Badge text="Recording" variant="error" />
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Clock size={12} color="#94a3b8" />
                      <Text style={{ fontSize: 12, color: "#94a3b8" }}>{formatTime(duration)}</Text>
                    </View>
                  </View>
                )}

                {recordingUri && step !== "recording" && (
                  <View style={{ flexDirection: "row", gap: 6, marginBottom: 12 }}>
                    <Badge text="Audio Captured" color="#4ade80" bgColor="rgba(74,222,128,0.15)" />
                    <Badge text={formatTime(duration)} color="#94a3b8" bgColor="rgba(148,163,184,0.15)" />
                  </View>
                )}

                <Text style={{ marginBottom: 24, fontSize: 40, color: "#fff", fontVariant: ["tabular-nums"] }}>
                  {formatTime(duration)}
                </Text>

                {step === "idle" && (
                  <TouchableOpacity
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                      startRecording();
                    }}
                    activeOpacity={0.85}
                  >
                    <View
                      style={{
                        shadowColor: "#0b5ed7",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.4,
                        shadowRadius: 20,
                        elevation: 12,
                      }}
                    >
                      <LinearGradient
                        colors={GRADIENTS.recording}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 128,
                          height: 128,
                          borderRadius: 64,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Mic size={40} color="#fff" />
                      </LinearGradient>
                    </View>
                  </TouchableOpacity>
                )}

                {step === "recording" && (
                  <View style={{ alignItems: "center", justifyContent: "center" }}>
                    <Animated.View
                      style={[
                        pulseRingStyle,
                        {
                          position: "absolute",
                          width: 152,
                          height: 152,
                          borderRadius: 76,
                          borderWidth: 2,
                          borderColor: "#d94040",
                        },
                      ]}
                    />
                    <Animated.View
                      style={[
                        pulseRingStyle,
                        {
                          position: "absolute",
                          width: 168,
                          height: 168,
                          borderRadius: 84,
                          borderWidth: 1,
                          borderColor: "rgba(217, 64, 64, 0.3)",
                        },
                      ]}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                        stopRecording();
                      }}
                      activeOpacity={0.85}
                      style={{
                        width: 128,
                        height: 128,
                        borderRadius: 64,
                        backgroundColor: "#d94040",
                        alignItems: "center",
                        justifyContent: "center",
                        shadowColor: "#d94040",
                        shadowOffset: { width: 0, height: 0 },
                        shadowOpacity: 0.5,
                        shadowRadius: 24,
                        elevation: 12,
                      }}
                    >
                      <Square size={36} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}

                {step === "recorded" && recordingUri && (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
                    <TouchableOpacity onPress={playRecording} activeOpacity={0.8}>
                      <GlassCard
                        intensity="heavy"
                        style={{
                          width: 56,
                          height: 56,
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 28,
                        }}
                      >
                        {isPlaying ? (
                          <Pause size={24} color="#fff" />
                        ) : (
                          <Play size={24} color="#fff" />
                        )}
                      </GlassCard>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        startRecording();
                      }}
                      activeOpacity={0.85}
                    >
                      <LinearGradient
                        colors={GRADIENTS.recording}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          alignItems: "center",
                          justifyContent: "center",
                          shadowColor: "#0b5ed7",
                          shadowOffset: { width: 0, height: 0 },
                          shadowOpacity: 0.35,
                          shadowRadius: 12,
                          elevation: 6,
                        }}
                      >
                        <Mic size={24} color="#fff" />
                      </LinearGradient>
                    </TouchableOpacity>
                  </View>
                )}

                {(step === "transcribing" || step === "enhancing" || step === "saving") && (
                  <View style={{ alignItems: "center", gap: 8 }}>
                    <Badge
                      text={
                        step === "transcribing" ? "Transcribing..." :
                        step === "enhancing" ? "Enhancing..." :
                        "Saving..."
                      }
                      color="#a78bfa"
                      bgColor="rgba(167,139,250,0.15)"
                    />
                  </View>
                )}

                {step === "idle" && !recordingUri && (
                  <Text style={{ marginTop: 16, fontSize: 12, color: "#64748b" }}>Tap to start recording</Text>
                )}
                {step === "recording" && (
                  <Text style={{ marginTop: 16, fontSize: 12, color: "rgba(217,64,64,0.7)" }}>Tap to stop</Text>
                )}
              </GlassCard>
            </AnimatedListItem>

            {/* Action Buttons (Transcribe / Enhance) */}
            {step === "recorded" && recordingUri && (
              <AnimatedListItem index={2}>
                <View style={{ marginTop: 16, flexDirection: "row", gap: 12 }}>
                  {!transcript && !enhancedText && (
                    <View style={{ flex: 1 }}>
                      <GradientButton
                        onPress={transcribe}
                        title="Transcribe"
                        icon={<Sparkles size={18} color="#fff" />}
                        gradient={GRADIENTS.primary}
                        fullWidth
                        disabled={isBusy}
                      />
                    </View>
                  )}
                </View>
              </AnimatedListItem>
            )}
          </>
        )}

        {/* === WRITE MODE: Direct text input === */}
        {inputMode === "write" && !hasContent && (
          <AnimatedListItem index={1}>
            <GlassCard intensity="medium" style={{ padding: 24, alignItems: "center" }}>
              <PenLine size={40} color="#818cf8" />
              <Text style={{ marginTop: 12, fontSize: 15, color: "#cbd5e1", textAlign: "center" }}>
                Type your story, memory, or journal entry below
              </Text>
            </GlassCard>
          </AnimatedListItem>
        )}

        {/* === TRANSCRIPT / CONTENT AREA (shared by both modes) === */}
        {(hasContent || inputMode === "write") && (
          <AnimatedListItem index={inputMode === "voice" ? 3 : 2}>
            <View style={{ marginTop: 16 }}>
              {/* Label + action buttons row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "600", color: "#94a3b8" }}>
                  {enhancedText ? "Enhanced Story" : hasContent ? "Transcript" : "Your Story"}
                </Text>
                {hasContent && (
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {/* Read Aloud */}
                    <TouchableOpacity
                      onPress={toggleReadAloud}
                      style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                    >
                      {isSpeaking ? (
                        <VolumeX size={14} color="#ef4444" />
                      ) : (
                        <Volume2 size={14} color="#818cf8" />
                      )}
                      <Text style={{ fontSize: 11, color: isSpeaking ? "#ef4444" : "#818cf8" }}>
                        {isSpeaking ? "Stop" : "Read Aloud"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <GlassCard intensity="light" style={{ padding: 16 }}>
                <TextInput
                  value={enhancedText || transcript}
                  onChangeText={(text) => {
                    if (enhancedText) {
                      setEnhancedText(text);
                    } else {
                      setTranscript(text);
                    }
                  }}
                  multiline
                  placeholder="Your transcribed text will appear here, or type directly..."
                  style={{ minHeight: 150, fontSize: 15, lineHeight: 24, color: "#fff", textAlignVertical: "top" }}
                  placeholderTextColor="#4a5568"
                />
              </GlassCard>

              {/* Enhance / Revert buttons below text area */}
              {hasContent && (
                <View style={{ marginTop: 12, flexDirection: "row", gap: 10 }}>
                  {!preEnhanceText ? (
                    <View style={{ flex: 1 }}>
                      <GradientButton
                        onPress={enhance}
                        title="Enhance with AI"
                        icon={<Sparkles size={16} color="#fff" />}
                        gradient={GRADIENTS.accent}
                        size="sm"
                        fullWidth
                        disabled={isBusy}
                        loading={step === "enhancing"}
                      />
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={revertEnhancement}
                      style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10 }}
                    >
                      <Undo2 size={14} color="#fbbf24" />
                      <Text style={{ fontSize: 13, color: "#fbbf24", fontWeight: "500" }}>Revert to Original</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </AnimatedListItem>
        )}

        {/* === STORY DETAILS (shown when there's content) === */}
        {hasContent && (
          <AnimatedListItem index={inputMode === "voice" ? 4 : 3}>
            <View style={{ marginTop: 20, gap: 14 }}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: "#e2e8f0" }}>Entry Details</Text>

              {/* Title */}
              <View>
                <GlassCard intensity="light" style={{ padding: 0 }}>
                  <TextInput
                    value={title}
                    onChangeText={(text) => { setTitle(text); setFieldErrors((prev) => ({ ...prev, title: "" })); }}
                    placeholder="Story title"
                    style={{ padding: 16, fontSize: 15, color: "#fff" }}
                    placeholderTextColor="#4a5568"
                    editable={!isBusy}
                  />
                </GlassCard>
                {fieldErrors.title && (
                  <Text style={{ marginTop: 4, marginLeft: 4, fontSize: 12, color: "#f87171" }}>
                    {fieldErrors.title}
                  </Text>
                )}
              </View>

              {/* Date of Memory */}
              <TouchableOpacity activeOpacity={0.8}>
                <GlassCard
                  intensity="light"
                  style={{ padding: 16, flexDirection: "row", alignItems: "center", gap: 12 }}
                >
                  <Calendar size={18} color="#818cf8" />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>Date of Memory</Text>
                    <TextInput
                      value={storyDate}
                      onChangeText={(text) => {
                        // Allow YYYY-MM-DD input
                        const cleaned = text.replace(/[^0-9-]/g, "");
                        if (cleaned.length <= 10) setStoryDate(cleaned);
                      }}
                      placeholder="YYYY-MM-DD"
                      style={{ fontSize: 15, color: "#fff", padding: 0 }}
                      placeholderTextColor="#4a5568"
                      keyboardType="numbers-and-punctuation"
                      editable={!isBusy}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>{formatDisplayDate(storyDate)}</Text>
                </GlassCard>
              </TouchableOpacity>

              {/* Mood Selector */}
              <View>
                <Text style={{ marginBottom: 8, fontSize: 13, color: "#94a3b8" }}>Mood</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {MOODS.map((m) => {
                      const isSelected = selectedMood === m;
                      return isSelected ? (
                        <GradientButton
                          key={m}
                          onPress={() => setSelectedMood(m)}
                          title={m}
                          gradient={GRADIENTS.primary}
                          size="sm"
                        />
                      ) : (
                        <TouchableOpacity
                          key={m}
                          onPress={() => setSelectedMood(m)}
                        >
                          <GlassCard
                            intensity="light"
                            style={{ paddingHorizontal: 16, paddingVertical: 8 }}
                          >
                            <Text style={{ fontSize: 13, color: "#94a3b8", textTransform: "capitalize" }}>
                              {m}
                            </Text>
                          </GlassCard>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>

              {/* Tags */}
              <GlassCard intensity="light" style={{ padding: 0 }}>
                <TextInput
                  value={tags}
                  onChangeText={setTags}
                  placeholder="Tags (comma separated)"
                  style={{ padding: 16, fontSize: 15, color: "#fff" }}
                  placeholderTextColor="#4a5568"
                  editable={!isBusy}
                />
              </GlassCard>

              {/* Visibility Toggle */}
              <TouchableOpacity onPress={() => !isBusy && setIsPublic(!isPublic)}>
                <GlassCard
                  intensity="light"
                  style={{
                    padding: 16,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 12,
                    ...(isPublic && { borderColor: "rgba(74,222,128,0.3)", borderWidth: 1 }),
                  }}
                >
                  {isPublic ? (
                    <Eye size={20} color="#4ade80" />
                  ) : (
                    <EyeOff size={20} color="#64748b" />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, color: "#fff", fontWeight: "500" }}>
                      {isPublic ? "Public" : "Private"}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                      {isPublic ? "Visible to everyone on the social feed" : "Only you can see this story"}
                    </Text>
                  </View>
                </GlassCard>
              </TouchableOpacity>

              {/* Save Button */}
              <GradientButton
                onPress={saveStory}
                title={isPublic ? "Publish & Save" : "Save Privately"}
                icon={<Save size={20} color="#fff" />}
                gradient={isPublic ? GRADIENTS.success : GRADIENTS.primary}
                size="lg"
                fullWidth
                disabled={isBusy || !title.trim() || !hasContent}
                loading={step === "saving"}
              />
            </View>
          </AnimatedListItem>
        )}

        {/* === RECORDING TIPS (shown when idle or in write mode with no content) === */}
        {((inputMode === "voice" && step === "idle" && !recordingUri) ||
          (inputMode === "write" && !hasContent)) && (
          <AnimatedListItem index={2}>
            <GlassCard
              intensity="light"
              style={{
                marginTop: 20,
                padding: 16,
                borderColor: "rgba(129,140,248,0.2)",
                borderWidth: 1,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <Lightbulb size={16} color="#818cf8" />
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#818cf8" }}>
                  {inputMode === "voice" ? "Recording Tips" : "Writing Tips"}
                </Text>
              </View>
              <View style={{ gap: 10 }}>
                {(inputMode === "voice" ? RECORDING_TIPS : [
                  { num: "1", text: "Write freely — don't worry about grammar" },
                  { num: "2", text: "AI can enhance your text after you write" },
                  { num: "3", text: "Set the date to capture past memories" },
                  { num: "4", text: "Stories are saved securely to the cloud" },
                ]).map((tip) => (
                  <View key={tip.num} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: "rgba(129,140,248,0.2)",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: "700", color: "#818cf8" }}>{tip.num}</Text>
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: "#94a3b8", lineHeight: 18 }}>{tip.text}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          </AnimatedListItem>
        )}

        <View style={{ height: 96 }} />
      </ScrollView>
    </SafeAreaView>
  );
}
