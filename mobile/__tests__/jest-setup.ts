// Jest setup for component tests — runs after jest-expo preset

// Mock expo-router
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: jest.fn(() => ({})),
  useGlobalSearchParams: jest.fn(() => ({})),
  usePathname: jest.fn(() => '/'),
  useSegments: jest.fn(() => []),
}));

// Mock expo-clipboard
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve(true)),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

// Mock expo-linear-gradient
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: any) => children,
}));

// Mock expo-blur
jest.mock('expo-blur', () => ({
  BlurView: ({ children }: any) => children,
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => {
  const RMockView = ({ children }: any) => children;
  return {
    __esModule: true,
    default: {
      View: RMockView,
      createAnimatedComponent: (Component: any) => Component,
    },
    useSharedValue: (v: number) => ({ value: v }),
    useAnimatedStyle: (fn: () => unknown) => fn(),
    withSpring: (v: number) => v,
    FadeIn: { delay: () => ({ duration: () => ({}) }) },
    FadeInUp: { delay: () => ({ duration: () => ({ springify: () => ({}) }) }) },
  };
});

// Mock react-native-safe-area-context
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  SafeAreaProvider: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

// Mock expo-image-picker
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  launchImageLibraryAsync: jest.fn(() => Promise.resolve({ canceled: true, assets: [] })),
  MediaTypeOptions: { Images: 'images' },
}));

// Mock wagmi
jest.mock('wagmi', () => ({
  useAccount: () => ({ address: '0x123', isConnected: true }),
  WagmiProvider: ({ children }: any) => children,
}));

// Mock @reown/appkit-react-native
jest.mock('@reown/appkit-react-native', () => ({
  useAppKit: () => ({ open: jest.fn(), close: jest.fn() }),
}));

// Note: lucide-react-native and @react-native-masked-view/masked-view
// are mocked via __mocks__/ files and moduleNameMapper in jest.config.js
