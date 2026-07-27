// Root Layout - Provider stack + polyfills
// CRITICAL: polyfills MUST be the first import
import "../polyfills";
import "../global.css";

import React, { useEffect } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Toast from "react-native-toast-message";

import { wagmiAdapter, appKit } from "../lib/wagmi.config";
import { useAuthStore } from "../stores/authStore";
import { useNotifications } from "../hooks/useNotifications";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { initSentry } from "../lib/sentry";
import { useOfflineSync } from "../hooks/useOfflineSync";
import { useAuthSessionSync } from "../hooks/useAuthSessionSync";

// Initialize Sentry as early as possible
initSentry();

// AppKit only works on native (iOS/Android), not web
let AppKitModal: React.ComponentType | null = null;
let AppKitProvider: React.ComponentType<{
  children: React.ReactNode;
  instance: NonNullable<typeof appKit>;
}> | null = null;

if (Platform.OS !== "web") {
  const appKitModule = require("@reown/appkit-react-native");
  AppKitModal = appKitModule.AppKit;
  AppKitProvider = appKitModule.AppKitProvider;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

function AuthInitializer({ children }: { children: React.ReactNode }) {
  const initialize = useAuthStore((s) => s.initialize);
  useAuthSessionSync();

  useEffect(() => {
    initialize();
  }, [initialize]);

  return <>{children}</>;
}

function NotificationInitializer({ children }: { children: React.ReactNode }) {
  useNotifications();

  useEffect(() => {
    // Handle notification taps — deep link to relevant screen
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        if (data?.story_id) {
          router.push(`/story/${data.story_id}`);
        }
      }
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return <>{children}</>;
}

function SyncInitializer({ children }: { children: React.ReactNode }) {
  useOfflineSync();
  return <>{children}</>;
}

export default function RootLayout() {
  const content = (
    <WagmiProvider config={wagmiAdapter.wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <AuthInitializer>
          <SyncInitializer>
            <NotificationInitializer>
            <ErrorBoundary>
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: "#0f172a" },
                }}
              >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="story/[storyId]"
                options={{ headerShown: false, presentation: "card" }}
              />
              <Stack.Screen
                name="book/[bookId]"
                options={{ headerShown: false, presentation: "card" }}
              />
              <Stack.Screen
                name="auth/login"
                options={{ headerShown: false, presentation: "modal" }}
              />
              <Stack.Screen
                name="auth/signup"
                options={{ headerShown: false, presentation: "modal" }}
              />
              <Stack.Screen
                name="auth/onboarding"
                options={{ headerShown: false, presentation: "modal" }}
              />
              <Stack.Screen
                name="collection/[collectionId]"
                options={{ headerShown: false, presentation: "card" }}
              />
              <Stack.Screen
                name="pricing/index"
                options={{ headerShown: false, presentation: "modal" }}
              />
              </Stack>
            </ErrorBoundary>
            {AppKitModal && <AppKitModal />}
            <Toast />
            <StatusBar style="light" />
          </NotificationInitializer>
        </SyncInitializer>
      </AuthInitializer>
      </QueryClientProvider>
    </WagmiProvider>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {AppKitProvider && appKit ? (
          <AppKitProvider instance={appKit}>{content}</AppKitProvider>
        ) : (
          content
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
