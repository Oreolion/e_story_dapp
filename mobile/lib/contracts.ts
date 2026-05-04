import { parseAbi } from "viem";

// eStories Mobile - Smart Contract Addresses & ABIs
// Ported from web lib/contracts.ts

export const STORY_TOKEN_ADDRESS =
  "0xf9eDD76B55F58Bf4E8Ae2A90a1D6d8d44dfA74BC";
export const STORY_PROTOCOL_ADDRESS =
  "0xA51a4cA00cC4C81A5F7cB916D0BFa1a4aD6f4a71";
export const STORY_NFT_ADDRESS =
  "0x6D37ebc5eAEF37ecC888689f295D114187933342";
export const VERIFIED_METRICS_ADDRESS =
  "0x052B52A4841080a98876275d5f8E6d094c9E086C";

// Base Sepolia KeystoneForwarder
export const KEYSTONE_FORWARDER_ADDRESS =
  "0x82300bd7c3958625581cc2f77bc6464dcecdf3e5";

// Chain config
export const BASE_SEPOLIA_CHAIN_ID = 84532;

// 1. IStoryToken ABI (ERC20 + Burnable)
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

// 4. VerifiedMetrics ABI (Chainlink CRE)
export const VERIFIED_METRICS_ABI = parseAbi([
  "function onReport(bytes calldata metadata, bytes calldata report)",
  "function getMetrics(bytes32 storyId) view returns (uint8 significanceScore, uint8 emotionalDepth, uint8 qualityScore, uint32 wordCount, string[] themes, bytes32 attestationId, uint256 verifiedAt)",
  "function isVerified(bytes32 storyId) view returns (bool)",
  "function getAttestationId(bytes32 storyId) view returns (bytes32)",
  "function supportsInterface(bytes4 interfaceId) view returns (bool)",
  "event MetricsVerified(bytes32 indexed storyId, address indexed author, uint8 significanceScore, uint8 emotionalDepth, uint8 qualityScore, uint32 wordCount, bytes32 attestationId)",
]);
