// Testnet disclaimer banner — shown on blockchain-related screens
// Dismissible, persists dismissal across sessions
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { AlertTriangle, X } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const DISMISS_KEY = "@estory:testnet_banner_dismissed";

export function TestnetBanner() {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(DISMISS_KEY).then((value) => {
      if (value === "true") setDismissed(true);
    });
  }, []);

  const handleDismiss = async () => {
    setDismissed(true);
    await AsyncStorage.setItem(DISMISS_KEY, "true");
  };

  if (dismissed) return null;

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: "rgba(251, 191, 36, 0.1)",
        borderWidth: 1,
        borderColor: "rgba(251, 191, 36, 0.2)",
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        marginBottom: 12,
      }}
    >
      <AlertTriangle size={16} color="#fbbf24" />
      <Text style={{ flex: 1, fontSize: 12, color: "#fbbf24", lineHeight: 16 }}>
        Base Sepolia Testnet — No real assets involved
      </Text>
      <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <X size={14} color="#fbbf24" />
      </TouchableOpacity>
    </View>
  );
}
