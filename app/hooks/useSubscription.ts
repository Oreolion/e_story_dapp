"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/components/AuthProvider";

interface SubscriptionStatus {
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

interface PaymentInfo {
  address: string;
  amount: number;
  currency: string;
  plan: string;
  network: string;
  note: string;
}

export function useSubscription() {
  const { profile, getAccessToken, refreshProfile } = useAuth();
  const [status, setStatus] = useState<SubscriptionStatus>({
    plan: "free",
    active: false,
    expires_at: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
  const [creatingPlan, setCreatingPlan] = useState<string | null>(null);
  const prevActiveRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    const token = await getAccessToken();
    if (!token) return;

    try {
      const res = await fetch("/api/payment/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setStatus(data);

        // If status just became active (payment confirmed), refresh the auth
        // profile so subscription_plan propagates to the entire app
        if (data.active && !prevActiveRef.current) {
          await refreshProfile();
        }
        prevActiveRef.current = data.active;
      }
    } catch {
      // Silent fail — default to free
    }
  }, [getAccessToken, refreshProfile]);

  useEffect(() => {
    if (profile?.id) {
      fetchStatus();
    }
  }, [profile?.id, fetchStatus]);

  // Poll for payment confirmation while payment modal is open
  useEffect(() => {
    if (!paymentInfo) return;

    const interval = setInterval(() => {
      fetchStatus();
    }, 15_000); // Check every 15 seconds

    return () => clearInterval(interval);
  }, [paymentInfo, fetchStatus]);

  const subscribe = async (plan: string) => {
    const token = await getAccessToken();
    if (!token) throw new Error("Not authenticated");

    setCreatingPlan(plan);
    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ plan }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create payment");

      // If the server auto-activated a completed payment, refresh status
      if (data.activated) {
        await refreshProfile();
        await fetchStatus();
        return data;
      }

      setPaymentInfo(data);
      return data;
    } finally {
      setCreatingPlan(null);
    }
  };

  const clearPaymentInfo = () => setPaymentInfo(null);

  const [verifying, setVerifying] = useState(false);

  const verifyPayment = async () => {
    const token = await getAccessToken();
    if (!token) return;

    setVerifying(true);
    try {
      const res = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (data.verified) {
        setPaymentInfo(null);
        await refreshProfile();
        await fetchStatus();
      }

      return data;
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
