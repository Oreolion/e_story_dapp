import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { apiGet, apiPost } from "../lib/api";
import type { StoryMetadata } from "../types";
interface Analysis { status: string; attempts?: number; error_code?: string | null }
export function useStoryAnalysis(storyId: string | undefined, ownerId: string | undefined, enabled: boolean) {
  const key = `${ownerId ?? ""}:${storyId ?? ""}:${enabled}`;
  const current = useRef(key); current.current = key;
  const [snapshot, setSnapshot] = useState<{ key: string; metadata: StoryMetadata | null; analysis: Analysis }>({ key, metadata: null, analysis: { status: "unavailable" } });
  const [epoch, setEpoch] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let cancelled = false, polls = 0, inFlight = false; let timer: ReturnType<typeof setTimeout> | undefined;
    setSnapshot({ key, metadata: null, analysis: { status: "unavailable" } }); setBusy(false);
    const tick = async () => {
      if (!enabled || !storyId || cancelled || inFlight || AppState.currentState !== "active") return;
      inFlight = true;
      try {
        const response = await apiGet<{ metadata: StoryMetadata | null; analysis: Analysis }>(`/api/stories/${storyId}/metadata`);
        if (cancelled || current.current !== key) return;
        if (!response.ok || !response.data) return;
        setSnapshot({ key, ...response.data }); polls++;
        if (["queued", "running", "retry_wait"].includes(response.data.analysis.status) && polls < 24) timer = setTimeout(tick, 5000);
      } catch { /* Keep the last state and allow an explicit refresh. */ }
      finally { inFlight = false; }
    };
    void tick();
    const listener = AppState.addEventListener("change", state => { if (state === "active" && polls < 24) { if (timer) clearTimeout(timer); void tick(); } });
    return () => { cancelled = true; if (timer) clearTimeout(timer); listener.remove(); };
  }, [storyId, ownerId, enabled, key, epoch]);
  const retry = useCallback(async () => {
    if (!enabled || !storyId || busy) return false;
    setBusy(true);
    try {
      const response = await apiPost("/api/ai/analyze", { storyId, retry: true });
      if (current.current !== key) return false;
      if (response.ok) setEpoch(value => value + 1);
      return response.ok;
    } finally { if (current.current === key) setBusy(false); }
  }, [enabled, storyId, key, busy]);
  const valid = snapshot.key === key;
  const analysis: Analysis = valid ? snapshot.analysis : { status: "unavailable" };
  return { metadata: valid ? snapshot.metadata : null, analysis, retry, refresh: () => setEpoch(value => value + 1), busy, canRetry: analysis.status === "failed" && (analysis.attempts ?? 0) > 0 && (analysis.attempts ?? 2) < 2 && analysis.error_code !== "quota_exceeded" };
}
