const React = require("react");

function AppKit() {
  return null;
}

function AppKitProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function useAppKit() {
  return {
    open: async () => undefined,
    close: async () => undefined,
  };
}

class WagmiAdapter {
  constructor() {
    throw new Error("Wallet adapter is disabled in the Google Play release");
  }
}

function createAppKit() {
  return null;
}

module.exports = {
  AppKit,
  AppKitProvider,
  WagmiAdapter,
  createAppKit,
  useAppKit,
};
