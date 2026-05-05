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

export default function TabLayout() {
  return (
    <ErrorBoundary>
      <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <AnimatedTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="record"
        options={{
          title: "Record",
          tabBarIcon: ({ color, size }) => (
            <Mic size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracker"
        options={{
          title: "Tracker",
          tabBarIcon: ({ color, size }) => (
            <CalendarCheck size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: "Archive",
          tabBarIcon: ({ color, size }) => (
            <Archive size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="social"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} />
          ),
        }}
      />
      </Tabs>
    </ErrorBoundary>
  );
}
