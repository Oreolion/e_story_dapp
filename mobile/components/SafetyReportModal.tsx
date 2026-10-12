import React, { useEffect, useState } from "react";
import { Modal, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import Toast from "react-native-toast-message";
import { Flag, X } from "lucide-react-native";

import { apiPost } from "../lib/api";
import { GlassCard, GradientButton, GRADIENTS } from "./ui";

export type SafetyTarget = {
  targetType: "story" | "comment" | "user";
  targetId: string;
  label: string;
};

const REPORT_REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "hate", label: "Hate or abusive content" },
  { value: "sexual_content", label: "Sexual content" },
  { value: "violence", label: "Violence or threats" },
  { value: "self_harm", label: "Self-harm concern" },
  { value: "other", label: "Something else" },
] as const;

interface SafetyReportModalProps {
  target: SafetyTarget | null;
  onClose: () => void;
  onSubmitted?: () => void;
}

export function SafetyReportModal({
  target,
  onClose,
  onSubmitted,
}: SafetyReportModalProps) {
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]["value"]>("spam");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!target) {
      setReason("spam");
      setDetails("");
      setSubmitting(false);
    }
  }, [target]);

  const submit = async () => {
    if (!target || submitting) return;
    setSubmitting(true);
    const response = await apiPost("/api/safety/report", {
      targetType: target.targetType,
      targetId: target.targetId,
      reason,
      details,
    });
    setSubmitting(false);

    if (!response.ok) {
      Toast.show({
        type: "error",
        text1: response.error || "Unable to submit report",
      });
      return;
    }

    Toast.show({
      type: "success",
      text1: "Report submitted",
      text2: "Our safety team will review it.",
    });
    onSubmitted?.();
    onClose();
  };

  return (
    <Modal visible={Boolean(target)} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          backgroundColor: "rgba(0,0,0,0.82)",
          padding: 20,
        }}
      >
        <GlassCard intensity="heavy" style={{ maxHeight: "90%", padding: 20 }}>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Flag size={20} color="#fbbf24" />
            <Text accessibilityRole="header" style={{ flex: 1, marginLeft: 10, color: "#fff", fontSize: 18, fontWeight: "700" }}>
              Report {target?.label ?? "content"}
            </Text>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Close report form"
              hitSlop={12}
              style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
            >
              <X size={22} color="#94a3b8" />
            </TouchableOpacity>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text style={{ color: "#94a3b8", fontSize: 13, lineHeight: 19, marginBottom: 12 }}>
              Choose the reason that best describes the safety issue.
            </Text>
            {REPORT_REASONS.map((item) => {
              const selected = reason === item.value;
              return (
                <TouchableOpacity
                  key={item.value}
                  onPress={() => setReason(item.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  style={{
                    minHeight: 48,
                    justifyContent: "center",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selected ? "#a78bfa" : "rgba(255,255,255,0.1)",
                    backgroundColor: selected ? "rgba(124,58,237,0.16)" : "rgba(255,255,255,0.03)",
                    paddingHorizontal: 14,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ color: selected ? "#ddd6fe" : "#cbd5e1", fontSize: 14 }}>{item.label}</Text>
                </TouchableOpacity>
              );
            })}

            <TextInput
              value={details}
              onChangeText={setDetails}
              placeholder="Additional details (optional)"
              placeholderTextColor="#64748b"
              multiline
              maxLength={1000}
              accessibilityLabel="Additional report details"
              style={{
                minHeight: 96,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.1)",
                color: "#fff",
                padding: 12,
                marginTop: 8,
                marginBottom: 16,
                textAlignVertical: "top",
              }}
            />

            <GradientButton
              onPress={submit}
              title={submitting ? "Submitting..." : "Submit Report"}
              gradient={GRADIENTS.primary}
              loading={submitting}
              disabled={submitting}
              fullWidth
            />
          </ScrollView>
        </GlassCard>
      </View>
    </Modal>
  );
}
