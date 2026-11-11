// Public product messages only; do not import provider configuration in clients.
export const AI_SETUP_CODE = "AI_PROVIDER_SETUP_REQUIRED";
export const AI_SETUP_MESSAGE = "AI assistance is temporarily unavailable while service setup is completed. You can still write and save entries.";

export function aiActionErrorMessage(payload: unknown, fallback: string): string {
  return payload !== null && typeof payload === "object" && "code" in payload && payload.code === AI_SETUP_CODE
    ? AI_SETUP_MESSAGE : fallback;
}
