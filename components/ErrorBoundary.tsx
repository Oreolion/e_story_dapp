"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackMessage?: string;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      const { fallbackMessage = "Something went wrong" } = this.props;

      return (
        <Card className="card-elevated rounded-xl bg-[hsl(var(--tone-anxious)/0.05)] border-[hsl(var(--tone-anxious)/0.2)]">
          <CardContent className="py-8 text-center space-y-4">
            <div className="w-12 h-12 mx-auto bg-gradient-to-r from-[hsl(var(--tone-anxious))] to-[hsl(var(--tone-frustrated))] rounded-full flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {fallbackMessage}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                An unexpected error occurred. Please try again.
              </p>
              {process.env.NODE_ENV === "development" && this.state.error && (
                <p className="text-xs text-red-500 mt-2 font-mono">
                  {this.state.error.message}
                </p>
              )}
            </div>
            <Button
              onClick={this.handleReset}
              variant="outline"
              className="border-[hsl(var(--tone-anxious)/0.3)] text-[hsl(var(--tone-anxious))] hover:bg-[hsl(var(--tone-anxious)/0.1)]"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

