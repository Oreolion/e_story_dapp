// Stub for expo-modules-core/src/polyfill/dangerous-internal
// Installs the globalThis.expo polyfill that jest-expo expects

function installExpoGlobalPolyfill() {
  if (typeof globalThis.expo !== 'undefined') return;

  globalThis.expo = {
    EventEmitter: class EventEmitter {
      addListener() { return { remove: () => {} }; }
      removeAllListeners() {}
      emit() {}
    },
    NativeModule: class NativeModule {
      constructor() {}
    },
    SharedObject: class SharedObject {
      constructor() {}
    },
    modules: {},
  };
}

module.exports = {
  installExpoGlobalPolyfill,
};
