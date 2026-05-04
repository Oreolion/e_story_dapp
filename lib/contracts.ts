import { parseAbi } from "viem";

// Replace these with your deployed address from Hardhat/Remix
export const STORY_TOKEN_ADDRESS = "0xf9eDD76B55F58Bf4E8Ae2A90a1D6d8d44dfA74BC"; 
export const STORY_PROTOCOL_ADDRESS = "0xA51a4cA00cC4C81A5F7cB916D0BFa1a4aD6f4a71";
export const STORY_NFT_ADDRESS = "0x6D37ebc5eAEF37ecC888689f295D114187933342";

// 1. EStoryToken ABI (ERC20 + Burnable)
export const STORY_TOKEN_ABI = parseAbi([
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "event Transfer(address indexed from, address indexed to, uint256 value)",
]);

// 2. StoryProtocol ABI (Tipping & Paywalls)
export const STORY_PROTOCOL_ABI = parseAbi([
  "function tipCreator(address creator, uint256 amount, uint256 storyId)",
  "function payPaywall(address author, uint256 amount, uint256 contentId)",
  "event TipSent(address indexed from, address indexed to, uint256 amount, uint256 indexed storyId)",
  "event ContentUnlocked(address indexed payer, address indexed author, uint256 amount, uint256 indexed contentId)",
]);

// 3. StoryNFT ABI (Minting)
export const STORY_NFT_ABI = parseAbi([
  "function mintBook(string memory uri)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "event NFTMinted(uint256 indexed tokenId, address indexed recipient, string uri, string collectionType)",
]);

// 4. PrivateVerifiedMetrics ABI (Chainlink CRE - Privacy-preserving on-chain metrics)
// Base Sepolia KeystoneForwarder: 0x82300bd7c3958625581cc2f77bc6464dcecdf3e5
export const VERIFIED_METRICS_ADDRESS = process.env.NEXT_PUBLIC_VERIFIED_METRICS_ADDRESS || "0x158e08BCD918070C1703E8b84a6E2524D2AE5e4c";

// Legacy contract address for backward compatibility
export const LEGACY_VERIFIED_METRICS_ADDRESS = process.env.NEXT_PUBLIC_LEGACY_VERIFIED_METRICS_ADDRESS || "0x052B52A4841080a98876275d5f8E6d094c9E086C";

export const VERIFIED_METRICS_ABI = [
  // CRE report receiver (called by KeystoneForwarder)
  "function onReport(bytes calldata metadata, bytes calldata report)",
  // Read functions (privacy-preserving — minimal data)
  "function getMetrics(bytes32 storyId) view returns (bool meetsQualityThreshold, uint8 qualityTier, bytes32 metricsHash, bytes32 authorCommitment, bytes32 attestationId, uint256 verifiedAt)",
  "function isVerified(bytes32 storyId) view returns (bool)",
  "function getAttestationId(bytes32 storyId) view returns (bytes32)",
  // Privacy verification helpers
  "function verifyAuthor(bytes32 storyId, address author) view returns (bool)",
  "function verifyMetricsHash(bytes32 storyId, bytes32 hash) view returns (bool)",
  // ERC165
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  // Admin functions (owner only)
  "function setForwarderAddress(address _forwarder)",
  "function setExpectedAuthor(address _author)",
  "function setExpectedWorkflowName(string _name)",
  "function setExpectedWorkflowId(bytes32 _id)",
  // View functions
  "function getForwarderAddress() view returns (address)",
  "function getExpectedAuthor() view returns (address)",
  "function getExpectedWorkflowName() view returns (bytes10)",
  "function getExpectedWorkflowId() view returns (bytes32)",
  // Events (privacy-preserving — no raw scores or themes)
  "event MetricsVerified(bytes32 indexed storyId, bytes32 indexed authorCommitment, uint8 qualityTier, bool meetsQualityThreshold)",
  "event ForwarderAddressUpdated(address indexed previousForwarder, address indexed newForwarder)"
] as const;