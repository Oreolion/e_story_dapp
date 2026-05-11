/**
 * Meta Pixel (Facebook Pixel) tracking utilities
 * Pixel ID: 749978950873721
 *
 * Use these helpers to fire standard and custom events from anywhere in the app.
 * The base pixel script is loaded once in the root layout via <Script>.
 */

// Extend Window interface for fbq
declare global {
  interface Window {
    fbq: (
      command: "init" | "track" | "trackCustom",
      eventName: string,
      params?: Record<string, unknown>
    ) => void;
    _fbq?: typeof window.fbq;
  }
}

/** Standard Meta Pixel events */
export type StandardEvent =
  | "PageView"
  | "ViewContent"
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "Purchase"
  | "Search"
  | "Contact"
  | "CustomizeProduct"
  | "Donate"
  | "FindLocation"
  | "Schedule"
  | "StartTrial"
  | "SubmitApplication"
  | "Subscribe";

/** Custom events for eStories app */
export type CustomEvent =
  | "StoryRecorded"
  | "VoicePreviewPlayed"
  | "StoryShared"
  | "WaitlistJoined"
  | "AppDownloadClicked"
  | "StoryEnhanced"
  | "SubscriptionActivated";

/**
 * Fire a standard Meta Pixel event.
 * Safe to call anywhere — silently fails if fbq isn't loaded yet.
 */
export function trackEvent(
  eventName: StandardEvent,
  params?: Record<string, unknown>
): void {
  if (typeof window !== "undefined" && window.fbq) {
    try {
      if (params) {
        window.fbq("track", eventName, params);
      } else {
        window.fbq("track", eventName);
      }
    } catch (err) {
      console.warn("[Meta Pixel] trackEvent failed:", err);
    }
  }
}

/**
 * Fire a custom Meta Pixel event.
 * Safe to call anywhere — silently fails if fbq isn't loaded yet.
 */
export function trackCustomEvent(
  eventName: CustomEvent,
  params?: Record<string, unknown>
): void {
  if (typeof window !== "undefined" && window.fbq) {
    try {
      if (params) {
        window.fbq("trackCustom", eventName, params);
      } else {
        window.fbq("trackCustom", eventName);
      }
    } catch (err) {
      console.warn("[Meta Pixel] trackCustomEvent failed:", err);
    }
  }
}

/**
 * Track a page view manually (e.g. after client-side navigation).
 * The base code already fires PageView on initial load.
 */
export function trackPageView(): void {
  trackEvent("PageView");
}

/**
 * Track when a user views a specific story or content page.
 */
export function trackViewContent(
  contentName: string,
  contentType?: string,
  contentIds?: string[],
  value?: number,
  currency?: string
): void {
  trackEvent("ViewContent", {
    content_name: contentName,
    content_type: contentType,
    content_ids: contentIds,
    value,
    currency,
  });
}

/**
 * Track a lead capture (waitlist, contact form, etc.).
 */
export function trackLead(params?: Record<string, unknown>): void {
  trackEvent("Lead", params);
}

/**
 * Track account registration completion.
 */
export function trackCompleteRegistration(
  params?: Record<string, unknown>
): void {
  trackEvent("CompleteRegistration", params);
}

/**
 * Track when a user begins a subscription/purchase flow.
 */
export function trackInitiateCheckout(
  value?: number,
  currency?: string,
  contentName?: string,
  contentIds?: string[]
): void {
  trackEvent("InitiateCheckout", {
    value,
    currency,
    content_name: contentName,
    content_ids: contentIds,
  });
}

/**
 * Track a completed purchase/subscription.
 */
export function trackPurchase(
  value: number,
  currency: string,
  contentName?: string,
  contentIds?: string[],
  orderId?: string
): void {
  trackEvent("Purchase", {
    value,
    currency,
    content_name: contentName,
    content_ids: contentIds,
    order_id: orderId,
  });
}
