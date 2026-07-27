// Mock for expo-secure-store
module.exports = {
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  setItemAsync: jest.fn(() => Promise.resolve()),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
  WHEN_UNLOCKED: 'whenUnlocked',
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlockedThisDeviceOnly',
  AFTER_FIRST_UNLOCK: 'afterFirstUnlock',
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'afterFirstUnlockThisDeviceOnly',
  ALWAYS: 'always',
  ALWAYS_THIS_DEVICE_ONLY: 'alwaysThisDeviceOnly',
};
