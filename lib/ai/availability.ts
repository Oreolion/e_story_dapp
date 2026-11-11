import { runtimeConfiguration } from "@/lib/runtime/config";
import { AI_SETUP_CODE, AI_SETUP_MESSAGE } from "./messages";

// A deliberate operator hold is distinct from provider failure or exhausted quota.
// The release/configuration guards still run first and fail closed.
export function aiGenerationHold() {
  return runtimeConfiguration().aiMode === "disabled"
    ? { code: AI_SETUP_CODE, error: AI_SETUP_MESSAGE } : null;
}
