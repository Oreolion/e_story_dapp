// Hook: Mint book NFTs via StoryNFT contract
import { useWriteContract, useAccount } from "wagmi";
import { STORY_NFT_ADDRESS, STORY_NFT_ABI } from "../lib/contracts";
import Toast from "react-native-toast-message";

export function useStoryNFT() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const mintBook = async (tokenURI: string) => {
    try {
      const hash = await writeContractAsync({
        address: STORY_NFT_ADDRESS as `0x${string}`,
        abi: STORY_NFT_ABI,
        functionName: "mintBook",
        args: [tokenURI],
        value: BigInt(1000000000000000) as unknown as undefined, // 0.001 ETH mintFee
      });
      Toast.show({ type: "success", text1: "Book NFT minted!" });
      return hash;
    } catch (err) {
      console.error("[useStoryNFT] Mint failed:", err);
      Toast.show({ type: "error", text1: "Minting failed" });
      throw err;
    }
  };

  return { mintBook, address };
}
