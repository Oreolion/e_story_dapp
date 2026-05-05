import React from "react";
import { View, Text } from "react-native";
import { GradientButton } from "./GradientButton";
import type { LucideIcon } from "lucide-react-native";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 24 }}>
      {icon && (
        <View style={{ marginBottom: 16 }}>
          {icon}
        </View>
      )}
      <Text style={{ fontSize: 16, fontWeight: "600", color: "#e2e8f0", textAlign: "center" }}>
        {title}
      </Text>
      {subtitle && (
        <Text style={{ marginTop: 8, fontSize: 14, color: "#94a3b8", textAlign: "center", lineHeight: 20 }}>
          {subtitle}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: 20, width: "100%" }}>
          <GradientButton title={actionLabel} onPress={onAction} />
        </View>
      )}
    </View>
  );
}
