const React = require("react");

function disabledTransaction() {
  return Promise.reject(
    new Error("Web3 transactions are disabled in the Google Play release")
  );
}

function WagmiProvider({ children }) {
  return React.createElement(React.Fragment, null, children);
}

function createConfig(config) {
  return config;
}

function http(url) {
  return { url };
}

function useAccount() {
  return { address: undefined, isConnected: false };
}

function useSignMessage() {
  return { signMessageAsync: disabledTransaction };
}

function useReadContract() {
  return {
    data: undefined,
    isLoading: false,
    refetch: async () => ({ data: undefined }),
  };
}

function useWriteContract() {
  return {
    isPending: false,
    writeContractAsync: disabledTransaction,
  };
}

module.exports = {
  WagmiProvider,
  createConfig,
  http,
  useAccount,
  useReadContract,
  useSignMessage,
  useWriteContract,
};
