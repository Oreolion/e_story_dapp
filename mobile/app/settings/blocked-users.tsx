import React, { useCallback, useEffect, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Ban } from "lucide-react-native";

import { apiDelete, apiGet } from "../../lib/api";
import { Avatar, EmptyState, GlassCard, SkeletonLoader } from "../../components/ui";

interface BlockedUserRow {
  blocked_id: string;
  created_at: string;
  blocked: {
    id: string;
    name: string | null;
    username: string | null;
    avatar: string | null;
  } | null;
}

export default function BlockedUsersScreen() {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUserRow[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBlockedUsers = useCallback(async () => {
    const response = await apiGet<{ blockedUsers: BlockedUserRow[] }>("/api/safety/block");
    if (response.ok) setBlockedUsers(response.data?.blockedUsers ?? []);
    else Alert.alert("Unable to load blocked users", response.error || "Please try again.");
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadBlockedUsers();
  }, [loadBlockedUsers]);

  const unblock = (row: BlockedUserRow) => {
    const name = row.blocked?.name || row.blocked?.username || "this user";
    Alert.alert("Unblock user?", `You may see content from ${name} again.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: async () => {
          const response = await apiDelete("/api/safety/block", {
            blockedUserId: row.blocked_id,
          });
          if (response.ok) {
            setBlockedUsers((current) =>
              current.filter((item) => item.blocked_id !== row.blocked_id)
            );
          } else {
            Alert.alert("Unable to unblock", response.error || "Please try again.");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 }}>
        <TouchableOpacity
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          hitSlop={12}
          style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}
        >
          <ArrowLeft size={24} color="#fff" />
        </TouchableOpacity>
        <Text accessibilityRole="header" style={{ flex: 1, color: "#fff", fontSize: 18, fontWeight: "700", textAlign: "center" }}>
          Blocked Users
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.blocked_id}
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        renderItem={({ item }) => (
          <GlassCard intensity="light" style={{ padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }}>
            <Avatar uri={item.blocked?.avatar ?? null} name={item.blocked?.name ?? item.blocked?.username ?? "Blocked user"} size="md" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontSize: 15, fontWeight: "600" }}>
                {item.blocked?.name || item.blocked?.username || "Blocked user"}
              </Text>
              {item.blocked?.username && <Text style={{ color: "#64748b", fontSize: 12 }}>@{item.blocked.username}</Text>}
            </View>
            <TouchableOpacity
              onPress={() => unblock(item)}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${item.blocked?.name || item.blocked?.username || "user"}`}
              style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 10 }}
            >
              <Text style={{ color: "#a78bfa", fontWeight: "600" }}>Unblock</Text>
            </TouchableOpacity>
          </GlassCard>
        )}
        ListEmptyComponent={
          loading ? (
            <SkeletonLoader variant="card" count={3} />
          ) : (
            <EmptyState
              icon={<Ban size={44} color="#64748b" />}
              title="No blocked users"
              subtitle="People you block will appear here."
            />
          )
        }
      />
    </SafeAreaView>
  );
}
