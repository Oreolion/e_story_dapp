import { z } from "zod";
import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { runtimeConfiguration } from "@/lib/runtime/config";
export const receiptContract = z.object({
  id: z.string().uuid(), recipientAddress: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
  amountPaid: z.string().regex(/^\d{1,10}(?:\.\d{1,6})?$/),
  confirmed: z.literal(true), status: z.literal("SUCCESS"), type: z.literal("DEPOSIT"),
  network: z.enum(["mainnet", "testnet"]),
  asset: z.object({ id: z.string().uuid(), symbol: z.string() }),
  wallet: z.object({ id: z.string().uuid() }),
  address: z.object({ id: z.string().uuid() }),
});
export class PaymentUnavailable extends Error {}
export function paymentAcceptanceConfiguration() {
  const assets = new Set((process.env.BLOCKRADAR_ACCEPTED_ASSET_IDS ?? "").split(",").map(value => value.trim()).filter(Boolean));
  const network = process.env.BLOCKRADAR_PAYMENT_NETWORK;
  const wallet = process.env.BLOCKRADAR_WALLET_ID;
  if (!assets.size || !["mainnet", "testnet"].includes(network ?? "") || !wallet) throw new PaymentUnavailable("Payment acceptance is not configured");
  return { assets, network, wallet };
}
export function paymentConfiguration() {
  if (runtimeConfiguration().paymentMode === "disabled") throw new PaymentUnavailable("Payments are disabled");
  return paymentAcceptanceConfiguration();
}
export function parseAcceptedReceipt(input: unknown) {
  const config = paymentAcceptanceConfiguration();
  const parsed = receiptContract.safeParse(input);
  if (!parsed.success) throw new Error("Invalid or unconfirmed deposit receipt");
  const receipt = parsed.data;
  if (!config.assets.has(receipt.asset.id) || receipt.network !== config.network || receipt.wallet.id !== config.wallet) throw new Error("Deposit asset, network or wallet mismatch");
  return receipt;
}
export async function applyVerifiedReceipt(admin: ReturnType<typeof createSupabaseAdminClient>, input: unknown, expectedOwner?: string) {
  paymentConfiguration();
  const receipt = parseAcceptedReceipt(input);
  const { data: payment, error } = await admin.from("payments").select("id,user_id,currency,payment_address").eq("blockradar_address_id", receipt.address.id).maybeSingle();
  if (error) throw new PaymentUnavailable("Payment lookup unavailable");
  if (!payment) return { status: "unmatched" as const };
  if (expectedOwner && payment.user_id !== expectedOwner || payment.payment_address.toLowerCase() !== receipt.recipientAddress.toLowerCase() || payment.currency !== receipt.asset.symbol) throw new Error("Payment binding mismatch");
  const { data: activation, error: activationError } = await admin.rpc("activate_paid_payment", { p_payment_id: payment.id, p_amount: receipt.amountPaid, p_receipt_id: receipt.id });
  if (activationError || !activation) throw new PaymentUnavailable("Payment activation unavailable; receipt may be retried");
  return { status: activation.deferred === true ? "deferred" as const : "activated" as const, ...activation };
}
