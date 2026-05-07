// Tab Layout - Bottom navigation with custom glass tab bar
import React from "react";
import { Tabs } from "expo-router";
import {
  Home,
  Mic,
  CalendarCheck,
  Archive,
  Users,
  User,
} from "lucide-react-native";
import { AnimatedTabBar } from "../../components/ui";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";

export default function TabLayout() {
  return (
    <ErrorBoundary>
      <Tabs
        screenOptions={{ headerShown: false }}
        tabBar={(props: BottomTabBarProps) => <AnimatedTabBar {...props} />}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Home size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="record"
          options={{
            title: "Record",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Mic size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="tracker"
          options={{
            title: "Tracker",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <CalendarCheck size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="library"
          options={{
            title: "Archive",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Archive size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="social"
          options={{
            title: "Community",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <Users size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: "Profile",
            tabBarIcon: ({ color, size }: { color: string; size: number }) => (
              <User size={size} color={color} />
            ),
          }}
        />
      </Tabs>
    </ErrorBoundary>
  );
}
