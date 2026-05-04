import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  walletConnectWallet,
  coinbaseWallet,
  rainbowWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { baseSepolia, sepolia } from "wagmi/chains";

const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) {
  console.warn(
    "Warning: NEXT_PUBLIC_PROJECT_ID is not set in your environment variables."
  );
  console.warn("WalletConnect will not work in production.");
}

// Explicit wallet connectors — ensures MetaMask mobile deep linking works
// (getDefaultConfig can miss mobile deep links and show "Install" instead of "Open")
const connectors = connectorsForWallets(
  [
    {
      groupName: "Popular",
      wallets: [metaMaskWallet, coinbaseWallet, rainbowWallet, walletConnectWallet],
    },
  ],
  {
    appName: "EStories DApp",
    projectId: projectId || "",
  }
);

export const config = createConfig({
  connectors,
  chains: [baseSepolia, sepolia],
  transports: {
    [baseSepolia.id]: http(),
    [sepolia.id]: http(),
  },
  ssr: true,
});
