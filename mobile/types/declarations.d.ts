// Type declarations for packages without built types
// These packages ship JS-only or have missing .d.ts files in this environment

declare module "expo-router" {
  import * as React from "react";

  export const Stack: React.ComponentType<{
    screenOptions?: Record<string, unknown>;
    children?: React.ReactNode;
  }> & {
    Screen: React.ComponentType<{
      name: string;
      options?: Record<string, unknown>;
    }>;
  };

  export const Tabs: React.ComponentType<{
    screenOptions?: Record<string, unknown>;
    tabBar?: (props: any) => React.ReactElement;
    children?: React.ReactNode;
  }> & {
    Screen: React.ComponentType<{
      name: string;
      options?: {
        title?: string;
        tabBarIcon?: (props: { color: string; size: number; focused: boolean }) => React.ReactElement;
        headerShown?: boolean;
        presentation?: "card" | "modal" | "transparentModal" | "containedModal" | "containedTransparentModal" | "fullScreenModal" | "formSheet";
        [key: string]: unknown;
      };
    }>;
  };

  export const router: {
    push: (path: string) => void;
    replace: (path: string) => void;
    back: () => void;
    navigate: (path: string) => void;
    setParams: (params: Record<string, unknown>) => void;
  };

  export const useLocalSearchParams: <T = Record<string, string>>() => T;
  export const useGlobalSearchParams: <T = Record<string, string>>() => T;
  export const useRouter: () => typeof router;
  export const usePathname: () => string;
  export const useSegments: () => string[];
  export const useNavigation: () => unknown;
  export const Redirect: React.ComponentType<{ href: string }>;
  export const Slot: React.ComponentType<{ children?: React.ReactNode }>;
}

declare module "@reown/appkit-react-native" {
  import * as React from "react";

  export interface AppKitNetwork {
    id: number;
    name: string;
    nativeCurrency: { name: string; symbol: string; decimals: number };
    rpcUrls: { default: { http: string[] } };
    blockExplorers?: { default: { name: string; url: string } };
    chainNamespace: string;
    caipNetworkId: string;
  }

  export function createAppKit(options: Record<string, unknown>): unknown;
  export function useAppKit(): { open: () => void; close: () => void };

  export const AppKit: React.ComponentType;
  export const AppKitProvider: React.ComponentType<{
    children: React.ReactNode;
    instance: unknown;
  }>;
}

declare module "react-native-gesture-handler" {
  import * as React from "react";
  import { ViewProps } from "react-native";

  export const GestureHandlerRootView: React.ComponentType<ViewProps>;
}

declare module "expo-modules-core" {
  export interface PermissionResponse {
    status: "granted" | "denied" | "undetermined";
    granted: boolean;
    expires: "never" | number;
    canAskAgain: boolean;
  }
}
