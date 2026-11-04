"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import type { StoryMetadata } from "../types";
import { useAuth } from "@/components/AuthProvider";
export interface AnalysisState { status: string; attempts?: number; error_code?: string | null }
export interface UseStoryMetadataReturn {
  metadata: StoryMetadata | null; analysis: AnalysisState; isLoading: boolean; error: string | null;
  refetch: () => Promise<void>; markAsCanonical: (value: boolean) => Promise<boolean>; isUpdating: boolean;
  queueAnalysis: (retry?: boolean) => Promise<boolean>; isScheduling: boolean; canRetry: boolean;
}
const pending = new Set(["queued", "running", "retry_wait"]);
export function useStoryMetadata(storyId: string | null): UseStoryMetadataReturn {
  const { profile, getAccessToken } = useAuth();
  const ownerId = profile?.id ?? null;
  const key = `${ownerId ?? ""}:${storyId ?? ""}`;
  const keyRef = useRef(key); keyRef.current = key;
  const tokenRef = useRef(getAccessToken); tokenRef.current = getAccessToken;
  const controller = useRef<AbortController | null>(null);
  const [payloadKey, setPayloadKey] = useState(key);
  const [metadata, setMetadata] = useState<StoryMetadata | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: "unavailable" });
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pollEpoch, setPollEpoch] = useState(0);
  const fetchMetadata = useCallback(async () => {
    if (!storyId || !ownerId) return null;
    controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    try {
      const token = await tokenRef.current();
      if (request.signal.aborted || keyRef.current !== key) return null;
      const response = await fetch(`/api/stories/${storyId}/metadata`, { signal: request.signal, credentials: "same-origin", cache: "no-store", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!response.ok) throw new Error("Unable to load insights");
      const data = await response.json();
      if (request.signal.aborted || keyRef.current !== key) return null;
      const state: AnalysisState = data.analysis && typeof data.analysis.status === "string" ? { status: data.analysis.status, attempts: data.analysis.attempts, error_code: data.analysis.error_code } : { status: data.metadata ? "succeeded" : "unavailable" };
      setPayloadKey(key); setMetadata(data.metadata ?? null); setAnalysis(state); setError(null);
      return state;
    } catch {
      if (!request.signal.aborted && keyRef.current === key) setError("Unable to load insights. Please try again.");
      return null;
    } finally { if (!request.signal.aborted && keyRef.current === key) setIsLoading(false); }
  }, [storyId, ownerId, key]);
  useEffect(() => {
    let cancelled = false; let timer: ReturnType<typeof setTimeout> | undefined; let polls = 0;
    setMetadata(null); setAnalysis({ status: "unavailable" }); setError(null); setPayloadKey(key); setIsUpdating(false); setIsScheduling(false);
    setIsLoading(!!storyId && !!ownerId);
    const tick = async () => {
      const state = await fetchMetadata(); polls++;
      if (!cancelled && state && pending.has(state.status) && polls < 24) timer = setTimeout(tick, 5000);
    };
    if (storyId && ownerId) void tick();
    return () => { cancelled = true; if (timer) clearTimeout(timer); controller.current?.abort(); };
  }, [fetchMetadata, key, ownerId, storyId, pollEpoch]);
  const refetch = useCallback(async () => { setPollEpoch(value => value + 1); }, []);
  const queueAnalysis = useCallback(async (retry = false) => {
    if (!storyId || !ownerId || isScheduling) return false;
    setIsScheduling(true);
    try {
      const token = await tokenRef.current();
      if (keyRef.current !== key) return false;
      const response = await fetch("/api/ai/analyze", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ storyId, retry }) });
      if (keyRef.current !== key) return false;
      if (!response.ok) throw new Error("Scheduling failed");
      setPollEpoch(value => value + 1); return true;
    } catch { if (keyRef.current === key) setError("Analysis could not be queued. Please try again later."); return false; }
    finally { if (keyRef.current === key) setIsScheduling(false); }
  }, [storyId, ownerId, isScheduling, key]);
  const markAsCanonical = useCallback(async (value: boolean) => {
    if (!storyId || !ownerId || isUpdating) return false;
    setIsUpdating(true);
    try {
      const token = await tokenRef.current();
      if (keyRef.current !== key) return false;
      const response = await fetch(`/api/stories/${storyId}/metadata`, { method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ is_canonical: value }) });
      if (!response.ok || keyRef.current !== key) return false;
      setPollEpoch(value => value + 1); return true;
    } catch { return false; }
    finally { if (keyRef.current === key) setIsUpdating(false); }
  }, [storyId, ownerId, isUpdating, key]);
  const current = payloadKey === key;
  return { metadata: current ? metadata : null, analysis: current ? analysis : { status: "unavailable" }, isLoading, error: current ? error : null, refetch, markAsCanonical, isUpdating, queueAnalysis, isScheduling, canRetry: current && analysis.status === "failed" && (analysis.attempts ?? 0) >= 1 && (analysis.attempts ?? 2) < 2 && analysis.error_code !== "quota_exceeded" };
}
