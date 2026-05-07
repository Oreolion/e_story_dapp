// Mobile subscription hook — mirrors web useSubscription but uses mobile api client
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../stores/authStore";

export interface SubscriptionStatus {
  plan: string;
  active: boolean;
  expires_at: string | null;
  pending_payment?: {
    address: string;
    plan: string;
    amount: number;
    currency: string;
    expires_at: string;
  } | null;
}

export interface PaymentInfo {
  address: string;
  amount: number;
  currency: string;
  plan: string;
  network: string;
  note: string;
  activated?: boolean;
  expires_at?: string;
}

interface UseSubscriptionReturn {
  status: SubscriptionStatus;
  isLoading: boolean;
  paymentInfo: PaymentInfo | null;
  creatingPlan: string | null;
  verifying: boolean;
  subscribe: (plan: string) => Promise<void>;
  verifyPayment: () => Promise<{ verified: boolean; message?: string }>;
  clearPaymentInfo: () => void;
  refreshStatus: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { subscription, refreshSubscription } = useAuthStore();
  const [status, setStatus] = useState<SubscriptionStatus>({
    plan: subscription.plan,
    active: subscription.active,
    expires_at: subscription.expires_at,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [creatingPlan, setCreatingPlan] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const prevActiveRef = useRef(subscription.active);

  const fetchStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api<SubscriptionStatus>("/api/payment/status");
      if (res.ok && res.data) {
        setStatus(res.data);
        // Propagate to auth store
        if (res.data.active && !prevActiveRef.current) {
          await refreshSubscription();
        }
        prevActiveRef.current = res.data.active;
      }
    } catch {
      // Silent fail — default to free
    } finally {
      setIsLoading(false);
    }
  }, [refreshSubscription]);

  // Sync with auth store subscription on mount
  useEffect(() => {
    setStatus({
      plan: subscription.plan,
      active: subscription.active,
      expires_at: subscription.expires_at,
    });
  }, [subscription.plan, subscription.active, subscription.expires_at]);

  // Poll for payment confirmation while payment info is displayed
  useEffect(() => {
    if (!paymentInfo) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 15_000); // Every 15 seconds

    return () => clearInterval(interval);
  }, [paymentInfo, fetchStatus]);

  const subscribe = async (plan: string) => {
    setCreatingPlan(plan);
    try {
      const res = await api<PaymentInfo & { success?: boolean; activated?: boolean; expires_at?: string; error?: string }>(
        "/api/payment/create",
        {
          method: "POST",
          body: { plan },
        }
      );

      if (!res.ok || !res.data) {
        throw new Error(res.error || "Failed to create payment");
      }

      const data = res.data;

      if (data.activated) {
        await refreshSubscription();
        await fetchStatus();
        return;
      }

      setPaymentInfo({
        address: data.address,
        amount: data.amount,
        currency: data.currency,
        plan: data.plan,
        network: data.network,
        note: data.note,
      });
    } finally {
      setCreatingPlan(null);
    }
  };

  const clearPaymentInfo = () => setPaymentInfo(null);

  const verifyPayment = async () => {
    setVerifying(true);
    try {
      const res = await api<{
        verified: boolean;
        message?: string;
        plan?: string;
        expires_at?: string;
        error?: string;
      }>("/api/payment/verify", {
        method: "POST",
      });

      if (!res.ok) {
        throw new Error(res.error || "Verification failed");
      }

      const data = res.data;

      if (data?.verified) {
        setPaymentInfo(null);
        await refreshSubscription();
        await fetchStatus();
      }

      return { verified: data?.verified ?? false, message: data?.message };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verification failed";
      return { verified: false, message };
    } finally {
      setVerifying(false);
    }
  };

  return {
    status,
    isLoading,
    paymentInfo,
    creatingPlan,
    verifying,
    subscribe,
    verifyPayment,
    clearPaymentInfo,
    refreshStatus: fetchStatus,
  };
}
