"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../../components/AuthProvider";
import { WeeklyReflection } from "../types";

interface UseReflectionData {
  reflections: WeeklyReflection[];
  latestReflection: WeeklyReflection | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  canGenerate: boolean;
  currentWeekStart: string | null;
  generateReflection: () => Promise<WeeklyReflection | null>;
  refetch: () => Promise<void>;
}

export function useReflection(): UseReflectionData {
  const { profile: authInfo, getAccessToken, isLoading: isAuthLoading } = useAuth();

  const [reflections, setReflections] = useState<WeeklyReflection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canGenerate, setCanGenerate] = useState(false);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | null>(null);

  const fetchReflections = useCallback(async () => {
    if (isAuthLoading || !authInfo?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const token = await getAccessToken();
      if (!token) {
        setIsLoading(false);
        return;
      }
      const response = await fetch(`/api/ai/reflection?userId=${authInfo.id}&limit=10`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch reflections");
      }

      const data = await response.json();

      setReflections(data.reflections || []);
      setCanGenerate(data.canGenerate ?? true);
      setCurrentWeekStart(data.currentWeekStart || null);
    } catch (err) {
      console.error("Error fetching reflections:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch reflections");
    } finally {
      setIsLoading(false);
    }
  }, [authInfo?.id, isAuthLoading, getAccessToken]);

  useEffect(() => {
    fetchReflections();
  }, [fetchReflections]);

  const generateReflection = useCallback(async (): Promise<WeeklyReflection | null> => {
    if (!authInfo?.id || !authInfo?.wallet_address) {
      setError("Not authenticated");
      return null;
    }

    if (!canGenerate) {
      setError("You can only generate one reflection per week");
      return null;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const token = await getAccessToken();
      const response = await fetch("/api/ai/reflection", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId: authInfo.id,
          userWallet: authInfo.wallet_address,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate reflection");
      }

      const newReflection = data.reflection as WeeklyReflection;

      // Update state with new reflection
      setReflections(prev => [newReflection, ...prev]);
      setCanGenerate(false);

      return newReflection;
    } catch (err) {
      console.error("Error generating reflection:", err);
      const errorMessage = err instanceof Error ? err.message : "Failed to generate reflection";
      setError(errorMessage);
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, [authInfo?.id, authInfo?.wallet_address, canGenerate, getAccessToken]);

  // Get the latest reflection (most recent)
  const latestReflection = reflections.length > 0 ? reflections[0] : null;

  return {
    reflections,
    latestReflection,
    isLoading,
    isGenerating,
    error,
    canGenerate,
    currentWeekStart,
    generateReflection,
    refetch: fetchReflections,
  };
}
