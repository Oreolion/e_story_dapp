// eStories Mobile - Wagmi + Reown AppKit Configuration
// Replaces web lib/wagmi.config.ts (RainbowKit → Reown AppKit)

import { createAppKit } from "@reown/appkit-react-native";
import { WagmiAdapter } from "@reown/appkit-wagmi-react-native";
import type { AppKitNetwork } from "@reown/appkit-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";

const projectId =
  Constants.expoConfig?.extra?.WALLETCONNECT_PROJECT_ID || "";

// Base Sepolia chain definition for AppKit
const baseSepolia: AppKitNetwork = {
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://sepolia.base.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "BaseScan",
      url: "https://sepolia.basescan.org",
    },
  },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:84532",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const networks: [AppKitNetwork, ...AppKitNetwork[]] = [baseSepolia];

const metadata = {
  name: "eStories",
  description: "AI-powered sovereign storytelling platform",
  url: "https://estories.app",
  icons: ["https://estories.app/icon-192.png"],
  redirect: {
    native: "estory://",
    universal: "https://estories.app",
  },
};

// AsyncStorage wrapper conforming to AppKit's Storage interface
const appKitStorage = {
  getItem: async <T = string>(key: string): Promise<T | undefined> => {
    const value = await AsyncStorage.getItem(key);
    return (value ?? undefined) as T | undefined;
  },
  setItem: async <T = string>(key: string, value: T): Promise<void> => {
    await AsyncStorage.setItem(key, String(value));
  },
  removeItem: async (key: string): Promise<void> => {
    await AsyncStorage.removeItem(key);
  },
  getKeys: async (): Promise<string[]> => {
    return (await AsyncStorage.getAllKeys()) as string[];
  },
  getEntries: async <T = string>(): Promise<[string, T][]> => {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);
    return entries.map(([k, v]) => [k, (v ?? undefined) as T]) as [string, T][];
  },
};

// Create Wagmi Adapter
export const wagmiAdapter = new WagmiAdapter({
  projectId,
  // @ts-expect-error - AppKitNetwork <-> viem Chain type mismatch is a known Reown SDK issue
  networks,
});

// Create AppKit instance — called once at module level (native only)
import { Platform } from "react-native";

export let appKit: ReturnType<typeof createAppKit> | null = null;

if (Platform.OS !== "web" && projectId) {
  appKit = createAppKit({
    projectId,
    networks,
    adapters: [wagmiAdapter],
    metadata,
    storage: appKitStorage,
  });
}
