module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/__tests__/jest-setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((react-native.*|@react-native.*|expo.*|@expo.*|lucide-react-native|@reown/.*|wagmi|viem|@wagmi|@viem)/))',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/__tests__/components/**/*.test.{ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
  moduleNameMapper: {
    '^expo-modules-core$': '<rootDir>/__mocks__/expo-modules-core.js',
    '^expo-modules-core/src/polyfill/dangerous-internal$': '<rootDir>/__mocks__/expo-modules-core-polyfill.js',
    '^expo/src/winter$': '<rootDir>/__mocks__/expo-winter.js',
    '^@react-native-async-storage/async-storage$': '<rootDir>/__mocks__/@react-native-async-storage/async-storage.js',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-constants$': '<rootDir>/__mocks__/expo-constants.js',
    '^lucide-react-native$': '<rootDir>/__mocks__/lucide-react-native.js',
    '^@react-native-masked-view/masked-view$': '<rootDir>/__mocks__/@react-native-masked-view/masked-view.js',
    '^react-native-toast-message$': '<rootDir>/__mocks__/react-native-toast-message.js',
  },
};
