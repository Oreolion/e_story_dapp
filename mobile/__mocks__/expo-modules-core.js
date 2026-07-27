// Mock for expo-modules-core — required because the package ships without build output
module.exports = {
  NativeModulesProxy: {},
  requireNativeViewManager: () => () => null,
  requireNativeModule: () => ({}),
  EventEmitter: class EventEmitter {
    addListener() { return { remove: () => {} }; }
    removeAllListeners() {}
    emit() {}
  },
  NativeModule: class NativeModule {},
  SharedObject: class SharedObject {},
  requireOptionalNativeModule: () => null,
  registerWebModule: () => {},
};
