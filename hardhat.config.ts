import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const config: HardhatUserConfig & { etherscan?: any; sourcify?: any } = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  defaultNetwork: "baseSepolia",
  networks: {
    hardhat: {},
    baseSepolia: {
      url: "https://sepolia.base.org",
      accounts: process.env.ADMIN_WALLET_PRIVATE_KEY ? [process.env.ADMIN_WALLET_PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  // FIX: Manually configure Etherscan V2 endpoint for the older plugin
  etherscan: {
    apiKey: {
      baseSepolia: process.env.BASESCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "baseSepolia",
        chainId: 84532,
        urls: {
          // This is the critical line that fixes the "Deprecated V1" error
          apiURL: "https://api.etherscan.io/v2/api?chainid=84532", 
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  sourcify: {
    enabled: true
  }
};

export default config;