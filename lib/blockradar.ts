/**
 * Blockradar API client for stablecoin payment processing.
 *
 * Blockradar provides wallet infrastructure for receiving stablecoin payments
 * (USDC/USDT) on Base and other EVM chains. We use it for subscription payments.
 *
 * Flow:
 * 1. User clicks "Subscribe" → we create a child address via Blockradar
 * 2. User sends USDC/USDT to that address
 * 3. Blockradar sends a webhook (deposit.success) → we activate their subscription
 * 4. Auto-sweep moves funds to our master wallet
 */

const BLOCKRADAR_API_BASE = "https://api.blockradar.co/v1";

function getApiKey(): string {
  const key = process.env.BLOCKRADAR_API_KEY;
  if (!key) throw new Error("BLOCKRADAR_API_KEY not configured");
  return key;
}

function getWalletId(): string {
  const id = process.env.BLOCKRADAR_WALLET_ID;
  if (!id) throw new Error("BLOCKRADAR_WALLET_ID not configured");
  return id;
}

/** What consumers of createPaymentAddress receive */
export interface PaymentAddress {
  id: string;
  address: string;
  network: string;
}

/**
 * Blockradar's actual response shape for POST /wallets/:id/addresses.
 *
 * `data.address` is a flat string (the wallet address), NOT a nested object.
 * `data.id` is the address resource ID, `data.network` is e.g. "mainnet".
 */
interface BlockradarApiResponse {
  data: {
    id: string;
    address: string;
    name: string;
    network: string;
    metadata: Record<string, string> | null;
  };
  message: string;
  statusCode: number;
}

/**
 * Create a child address for a user to receive payment.
 * The address is tagged with the user's ID and plan for webhook reconciliation.
 */
export async function createPaymentAddress(
  userId: string,
  plan: string
): Promise<PaymentAddress> {
  const res = await fetch(
    `${BLOCKRADAR_API_BASE}/wallets/${getWalletId()}/addresses`,
    {
      method: "POST",
      headers: {
        "x-api-key": getApiKey(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `eStories-${plan}-${userId.slice(0, 8)}`,
        disableAutoSweep: false, // Auto-sweep deposits to master wallet
        enableGaslessWithdraw: false,
        metadata: {
          user_id: userId,
          plan,
          created_at: new Date().toISOString(),
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("[BLOCKRADAR] Create address failed:", err);
    throw new Error("Failed to create payment address");
  }

  const json: BlockradarApiResponse = await res.json();
  const { id, address, network } = json.data;

  if (!address) {
    console.error("[BLOCKRADAR] Unexpected response — no address string:", JSON.stringify(json.data).slice(0, 500));
    throw new Error("Blockradar returned an invalid address");
  }

  return { id, address, network };
}

/**
 * Plan pricing in USDC (stablecoin, 1:1 USD).
 */
export const PLAN_PRICES: Record<string, number> = {
  storyteller: 2.99,
  creator: 7.99,
};

/**
 * Validate that a deposit amount meets the plan's price.
 */
export function isPaymentSufficient(
  amountPaid: string | number,
  plan: string
): boolean {
  const price = PLAN_PRICES[plan];
  if (!price) return false;
  const amount = typeof amountPaid === "string" ? parseFloat(amountPaid) : amountPaid;
  // Allow small tolerance for rounding
  return amount >= price - 0.01;
}
