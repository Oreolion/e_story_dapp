import React, { Component, type ReactNode } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { GradientButton } from "./ui/GradientButton";
import { Sentry } from "../lib/sentry";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    Sentry?.captureException(error, {
      extra: { componentStack: errorInfo.componentStack },
      tags: { error_boundary: "true" },
    });
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View className="flex-1 items-center justify-center bg-[#0f172a] px-6">
          <View className="w-16 h-16 rounded-full bg-red-500/10 items-center justify-center mb-6">
            <Text className="text-red-400 text-2xl">!</Text>
          </View>

          <Text className="text-white text-xl font-semibold mb-2 text-center">
            Something went wrong
          </Text>

          <Text className="text-slate-400 text-sm text-center mb-8 leading-5">
            We encountered an unexpected error. Your data is safe — try again or restart the app.
          </Text>

          {__DEV__ && this.state.error && (
            <View className="w-full bg-red-500/5 rounded-xl p-4 mb-6">
              <Text className="text-red-400 text-xs font-mono" numberOfLines={4}>
                {this.state.error.toString()}
              </Text>
            </View>
          )}

          <GradientButton
            title="Try Again"
            onPress={this.handleRetry}
            className="w-full"
          />

          <TouchableOpacity
            onPress={() => {
              // Force reload - on native this restarts the bundle
              if (typeof global !== "undefined" && (global as any).DevSettings) {
                (global as any).DevSettings.reload();
              }
            }}
            className="mt-4 px-4 py-2"
          >
            <Text className="text-slate-500 text-sm">Restart App</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}
