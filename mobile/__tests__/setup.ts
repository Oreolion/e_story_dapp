// @ts-nocheck
// Mobile test setup — mocks for React Native and Expo modules
import { vi } from "vitest";

// Mock React Native (Flow syntax breaks parser — cannot use vi.importActual)
vi.mock("react-native", () => {
  const React = require("react");
  return {
    Platform: { OS: "ios", select: (obj) => obj.ios },
    Alert: { alert: vi.fn() },
    Share: { share: vi.fn() },
    Linking: { openURL: vi.fn(), canOpenURL: vi.fn(() => Promise.resolve(true)) },
    Dimensions: { get: vi.fn(() => ({ width: 375, height: 812 })) },
    StyleSheet: { create: (s) => s, flatten: (s) => (Array.isArray(s) ? Object.assign({}, ...s) : s) },
    View: ({ children, ...props }) => React.createElement("div", props, children),
    Text: ({ children, ...props }) => React.createElement("span", props, children),
    ScrollView: ({ children, ...props }) => React.createElement("div", { ...props, "data-testid": "scroll-view" }, children),
    TouchableOpacity: ({ children, onPress, ...props }) => React.createElement("button", { ...props, onClick: onPress }, children),
    Modal: ({ children, visible }) => visible ? React.createElement("div", { "data-testid": "modal" }, children) : null,
    ActivityIndicator: () => React.createElement("span", null, "Loading..."),
    TextInput: (props) => React.createElement("input", props),
    Pressable: ({ children, onPress, ...props }) => React.createElement("button", { ...props, onClick: onPress }, children),
  };
});

vi.mock("lucide-react-native", () => ({
  ArrowLeft: () => null,
  Check: () => null,
  X: () => null,
  Star: () => null,
  Zap: () => null,
  Copy: () => null,
  CopyCheck: () => null,
  RefreshCw: () => null,
  Wallet: () => null,
  Crown: () => null,
  ChevronRight: () => null,
  User: () => null,
  LogOut: () => null,
  Mail: () => null,
  Edit3: () => null,
  Camera: () => null,
  Trash2: () => null,
}));

vi.mock("expo-router", () => ({
  router: { push: vi.fn(), replace: vi.fn(), back: vi.fn(), navigate: vi.fn() },
  useLocalSearchParams: vi.fn(() => ({})),
  useGlobalSearchParams: vi.fn(() => ({})),
  usePathname: vi.fn(() => "/"),
  useSegments: vi.fn(() => []),
}));

vi.mock("expo-clipboard", () => ({
  setStringAsync: vi.fn(() => Promise.resolve(true)),
  getStringAsync: vi.fn(() => Promise.resolve("")),
}));

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  setItemAsync: vi.fn(() => Promise.resolve()),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

vi.mock("react-native-toast-message", () => ({
  default: { show: vi.fn(), hide: vi.fn() },
}));

vi.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }) => children,
}));

vi.mock("expo-blur", () => ({
  BlurView: ({ children }) => children,
}));

vi.mock("react-native-reanimated", () => ({
  __esModule: true,
  default: {
    View: ({ children }) => children,
    createAnimatedComponent: (Component) => Component,
  },
  useSharedValue: (v) => ({ value: v }),
  useAnimatedStyle: (fn) => fn(),
  withSpring: (v) => v,
  FadeIn: { delay: () => ({ duration: () => ({}) }) },
  FadeInUp: { delay: () => ({ duration: () => ({ springify: () => ({}) }) }) },
}));

vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }) => children,
  SafeAreaProvider: ({ children }) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    getAllKeys: vi.fn(() => Promise.resolve([])),
    multiGet: vi.fn(() => Promise.resolve([])),
  },
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x123", isConnected: true }),
  WagmiProvider: ({ children }) => children,
}));

vi.mock("@reown/appkit-react-native", () => ({
  useAppKit: () => ({ open: vi.fn(), close: vi.fn() }),
}));

vi.mock("expo-image-picker", () => ({
  requestMediaLibraryPermissionsAsync: vi.fn(() => Promise.resolve({ status: "granted" })),
  launchImageLibraryAsync: vi.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: "images" },
}));
