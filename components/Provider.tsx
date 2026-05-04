"use client";
import { ThemeProvider } from "next-themes";
import { createContext, useContext, ReactNode, useState } from "react";
import { WagmiProvider } from "wagmi";
import {
  QueryClient,
  QueryClientProvider,
  QueryCache,
  MutationCache,
} from "@tanstack/react-query";
import { RainbowKitProvider, darkTheme, lightTheme } from "@rainbow-me/rainbowkit";
import { useTheme } from "next-themes";
import { config } from "@/lib/wagmi.config";
import { useAccount, useBalance } from "wagmi";
import { AuthProvider } from "./AuthProvider";
import { BackgroundProvider } from "@/contexts/BackgroundContext";
import { ApiError } from "@/lib/api";

// Create QueryClient with auth-aware defaults.
// staleTime: 30s prevents excessive refetching on tab switches.
// gcTime: 5m keeps data in cache for quick back-navigation.
// Retries: 1 for 401s (auth might recover), 2 for others.
function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status === 401) {
            // Auth may recover on retry (e.g., after refresh)
            return failureCount < 1;
          }
          return failureCount < 2;
        },
      },
      mutations: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status === 401) {
            return failureCount < 1;
          }
          return failureCount < 1;
        },
      },
    },
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error(`[RQ Query Error] ${query.queryKey}:`, error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        console.error(`[RQ Mutation Error] ${mutation.options.mutationKey}:`, error);
      },
    }),
  });
}

interface User {
  address: string;
  addressDisplay: string;
  balance: string;
  storyTokens: number;
  badges: string[];
}
interface AppContextType {
  user: User | null;
  isConnected: boolean;
  isDisconnected: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
}
const AppContext = createContext<AppContextType | undefined>(undefined);
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within AppProvider");
  }
  return context;
}
function AppInner({ children }: { children: ReactNode }) {
  const { address, isConnected, isDisconnected } = useAccount();
  const { data: ethBalance } = useBalance({ address });
  const user: User | null =
    isConnected && address
      ? {
          addressDisplay: `${address.slice(0, 6)}...${address.slice(-4)}`,
          address: address,
          balance: ethBalance?.formatted || "0",
          storyTokens: 150,
          badges: ["Early Adopter", "10-Day Streak"],
        }
      : null;
  return (
    <AppContext.Provider
      value={{
        user,
        isConnected,
        isDisconnected,
        connectWallet: () => {},
        disconnectWallet: () => {},
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
function ThemedRainbowKit({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const rainbowTheme = resolvedTheme === "light" ? lightTheme() : darkTheme();

  return (
    <RainbowKitProvider theme={rainbowTheme}>
      {children}
    </RainbowKitProvider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(createQueryClient);

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <ThemedRainbowKit>
            <BackgroundProvider>
              <AuthProvider>
                <AppInner>{children}</AppInner>
              </AuthProvider>
            </BackgroundProvider>
          </ThemedRainbowKit>
        </ThemeProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
