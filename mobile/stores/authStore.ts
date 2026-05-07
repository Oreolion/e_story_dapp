// eStories Mobile - Auth Store (Zustand)
// Replaces web AuthProvider.tsx context with Zustand store for RN

import { create } from "zustand";
import { removeItem } from "../lib/storage";
import { supabase } from "../lib/supabase";
import { api, setAuthToken, clearAuthToken } from "../lib/api";
import type { OnboardingData, SignupData } from "../types";

const TOKEN_KEY = "supabase_access_token";
const REFRESH_KEY = "supabase_refresh_token";

export interface UserProfile {
  id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  wallet_address: string | null;
  email: string | null;
  bio: string | null;
  badges: string[] | null;
  google_id: string | null;
  subscription_plan: string | null;
  subscription_expires_at: string | null;
  created_at: string;
}

interface SubscriptionInfo {
  plan: string;
  active: boolean;
  expires_at: string | null;
}

interface AuthState {
  user: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  authMethod: "wallet" | "google" | "email" | null;
  subscription: SubscriptionInfo;

  // Actions
  initialize: () => Promise<void>;
  loginWithWallet: (address: string, signMessage: (message: string) => Promise<string>) => Promise<void>;
  loginWithGoogle: (accessToken: string, refreshToken: string) => Promise<{ needsOnboarding: boolean }>;
  loginWithGoogleIdToken: (accessToken: string, refreshToken: string) => Promise<{ needsOnboarding: boolean }>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (data: SignupData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  completeOnboarding: (data: OnboardingData) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshSubscription: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,
  authMethod: null,
  subscription: { plan: "free", active: false, expires_at: null },

  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await setAuthToken(session.access_token);
        await get().fetchProfile();
        await get().refreshSubscription();
        const provider = session.user?.app_metadata?.provider;
        const authMethod = provider === "google" ? "google" : provider === "email" ? "email" : "wallet";
        set({ isAuthenticated: true, authMethod });
      }
    } catch (err) {
      console.error("[Auth] Initialize failed:", err);
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithWallet: async (address, signMessage) => {
    set({ isLoading: true });
    try {
      // 1. Get nonce
      const nonceRes = await api<{ nonce: string; message: string }>(
        `/api/auth/nonce?address=${address}`
      );
      if (!nonceRes.ok || !nonceRes.data) {
        throw new Error(nonceRes.error || "Failed to get nonce");
      }

      // 2. Sign the message
      const signature = await signMessage(nonceRes.data.message);

      // 3. Login with signature
      const loginRes = await api<{
        token: string;
        session_token?: string;
        user: UserProfile;
      }>("/api/auth/login", {
        method: "POST",
        body: { address, signature, nonce: nonceRes.data.nonce },
      });

      if (!loginRes.ok || !loginRes.data) {
        throw new Error(loginRes.error || "Login failed");
      }

      // 4. Store token & set session
      await setAuthToken(loginRes.data.token);

      if (loginRes.data.session_token) {
        await supabase.auth.verifyOtp({
          token_hash: loginRes.data.session_token,
          type: "email",
        });
      }

      set({
        user: loginRes.data.user,
        isAuthenticated: true,
        authMethod: "wallet",
      });
      await get().refreshSubscription();
    } catch (err) {
      console.error("[Auth] Wallet login failed:", err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogle: async (accessToken: string, refreshToken: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) throw error;
      if (!data.session) throw new Error("No session returned");

      await setAuthToken(data.session.access_token);
      await get().fetchProfile();
      await get().refreshSubscription();
      set({ isAuthenticated: true, authMethod: "google" });

      const user = get().user;
      return { needsOnboarding: !user?.name || !user?.username };
    } catch (err) {
      console.error("[Auth] Google login failed:", err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithGoogleIdToken: async (accessToken: string, refreshToken: string) => {
    set({ isLoading: true });
    try {
      await setAuthToken(accessToken);
      await get().fetchProfile();
      await get().refreshSubscription();
      set({ isAuthenticated: true, authMethod: "google" });

      const user = get().user;
      return { needsOnboarding: !user?.name || !user?.username };
    } catch (err) {
      console.error("[Auth] Google ID token login failed:", err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  loginWithEmail: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) throw error;
      if (!data.session) throw new Error("No session returned");

      await setAuthToken(data.session.access_token);
      await get().fetchProfile();
      await get().refreshSubscription();
      set({ isAuthenticated: true, authMethod: "email" });
    } catch (err) {
      console.error("[Auth] Email login failed:", err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  signupWithEmail: async (data: SignupData) => {
    set({ isLoading: true });
    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
      });

      if (error) throw error;
      if (!authData.session) throw new Error("No session returned. Check your email for confirmation.");

      await setAuthToken(authData.session.access_token);

      // Complete onboarding in one step
      await api("/api/auth/onboarding", {
        method: "POST",
        body: {
          name: data.name,
          username: data.username,
          email: data.email,
          userId: authData.user?.id,
        },
      });

      await get().fetchProfile();
      await get().refreshSubscription();
      set({ isAuthenticated: true, authMethod: "email" });
    } catch (err) {
      console.error("[Auth] Email signup failed:", err);
      throw err;
    } finally {
      set({ isLoading: false });
    }
  },

  resetPassword: async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  },

  logout: async () => {
    try {
      await supabase.auth.signOut();
      await clearAuthToken();
      await removeItem(TOKEN_KEY);
      await removeItem(REFRESH_KEY);
      set({ user: null, isAuthenticated: false, authMethod: null, subscription: { plan: "free", active: false, expires_at: null } });
    } catch (err) {
      console.error("[Auth] Logout failed:", err);
    }
  },

  deleteAccount: async () => {
    const res = await api("/api/user", { method: "DELETE" });
    if (!res.ok) {
      throw new Error(res.error || "Failed to delete account");
    }
    await supabase.auth.signOut();
    await clearAuthToken();
    await removeItem(TOKEN_KEY);
    await removeItem(REFRESH_KEY);
    set({ user: null, isAuthenticated: false, authMethod: null, subscription: { plan: "free", active: false, expires_at: null } });
  },

  fetchProfile: async () => {
    try {
      const res = await api<{ user: UserProfile }>("/api/user/profile");
      if (res.ok && res.data) {
        set({ user: res.data.user });
      }
    } catch (err) {
      console.error("[Auth] Fetch profile failed:", err);
    }
  },

  refreshSubscription: async () => {
    try {
      const res = await api<{
        plan: string;
        active: boolean;
        expires_at: string | null;
      }>("/api/payment/status");
      if (res.ok && res.data) {
        set({ subscription: res.data });
      }
    } catch (err) {
      console.error("[Auth] Refresh subscription failed:", err);
    }
  },

  completeOnboarding: async (data: OnboardingData) => {
    const user = get().user;
    if (!user) return;

    const res = await api("/api/auth/onboarding", {
      method: "POST",
      body: { ...data, userId: user.id },
    });

    if (res.ok) {
      set({
        user: { ...user, name: data.name, username: data.username, email: data.email },
      });
    }
  },

  updateProfile: async (updates: Partial<UserProfile>) => {
    const res = await api("/api/user/profile", {
      method: "PUT",
      body: updates as Record<string, unknown>,
    });

    if (res.ok) {
      const user = get().user;
      if (user) {
        set({ user: { ...user, ...updates } });
      }
    }
  },
}));
