"use client";

import { useWriteContract, useWaitForTransactionReceipt, useReadContract, useAccount } from "wagmi";
import { parseEther } from "viem";
import { STORY_PROTOCOL_ADDRESS, STORY_PROTOCOL_ABI, STORY_TOKEN_ADDRESS, STORY_TOKEN_ABI } from "@/lib/contracts";
import { toast } from "react-hot-toast";
import { useEffect } from "react";

export function useStoryProtocol() {
  const { address } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  // Check allowance first
  const { data: allowanceData } = useReadContract({
    address: STORY_TOKEN_ADDRESS,
    abi: STORY_TOKEN_ABI,
    functionName: "allowance",
    args: address ? [address, STORY_PROTOCOL_ADDRESS] : undefined,
    query: { enabled: !!address },
  });

  // Cast allowance data to bigint (useReadContract returns {} | undefined)
  const allowance = allowanceData as bigint | undefined;

  // 1. Tip Creator
  const tipCreator = async (creatorAddress: string, amount: number, storyId: string) => {
    const amountWei = parseEther(amount.toString());

    // Check Allowance
    if (!allowance || allowance < amountWei) {
      toast.error("Please approve tokens first (via Token Hook)");
      return;
    }

    try {
      writeContract({
        address: STORY_PROTOCOL_ADDRESS,
        abi: STORY_PROTOCOL_ABI,
        functionName: "tipCreator",
        args: [creatorAddress as `0x${string}`, amountWei, BigInt(storyId)],
      });
      toast.loading("Sending tip...", { id: "tx-toast" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to initiate tip");
    }
  };

  // 2. Pay Paywall
  const payPaywall = async (authorAddress: string, amount: number, storyId: string) => {
    const amountWei = parseEther(amount.toString());

    if (!allowance || allowance < amountWei) {
      toast.error("Please approve tokens first");
      return;
    }

    try {
      writeContract({
        address: STORY_PROTOCOL_ADDRESS,
        abi: STORY_PROTOCOL_ABI,
        functionName: "payPaywall",
        args: [authorAddress as `0x${string}`, amountWei, BigInt(storyId)],
      });
      toast.loading("Unlocking content...", { id: "tx-toast" });
    } catch (err) {
      console.error(err);
      toast.error("Failed to initiate payment");
    }
  };

  // Transaction Feedback
  const { isSuccess: isConfirmed, isError: isTxError } = useWaitForTransactionReceipt({ 
    hash 
  });

  useEffect(() => {
    if (isConfirmed) {
      toast.success("Transaction successful!", { id: "tx-toast" });
    }
    if (isTxError || error) {
      toast.error("Transaction failed", { id: "tx-toast" });
    }
  }, [isConfirmed, isTxError, error]);

  return {
    tipCreator,
    payPaywall,
    isPending,
    hash
  };
}