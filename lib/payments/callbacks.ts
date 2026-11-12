import type { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { applyVerifiedReceipt, parseAcceptedReceipt, paymentConfiguration, PaymentUnavailable } from "./receipts";
import { z } from "zod";
type Admin = ReturnType<typeof createSupabaseAdminClient>;
const claimContract = z.object({ receipt: z.unknown(), lease_token: z.string().uuid() });

export async function retainPaymentCallback(admin: Admin, input: unknown) {
  const receipt = parseAcceptedReceipt(input);
  const { data, error } = await admin.rpc("istory_retain_payment_callback", { p_receipt: receipt });
  if (error || data !== true) throw new PaymentUnavailable("Callback persistence unavailable");
  return { received: true, retained: true };
}

/** Bounded one-receipt drain. It never sends provider requests or notifications. */
export async function replayPaymentCallback(admin: Admin) {
  paymentConfiguration(); // No claim while payments or application admission are held.
  const { data, error } = await admin.rpc("istory_claim_payment_callback");
  if (error) throw new PaymentUnavailable("Callback claim unavailable");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return { status: "idle" };
  const claim = claimContract.parse(row);
  const receipt = parseAcceptedReceipt(claim.receipt);
  try {
    const result = await applyVerifiedReceipt(admin, receipt);
    if (result.status === "unmatched") throw new PaymentUnavailable("Callback requires reconciliation");
    const { data: committed, error: finishError } = await admin.rpc("istory_finish_payment_callback", {
      p_receipt_id: receipt.id, p_lease_token: claim.lease_token, p_success: true,
    });
    if (finishError) throw new PaymentUnavailable("Callback acknowledgement unavailable");
    return { status: committed === true ? "processed" : "superseded" };
  } catch {
    const { error: failureError } = await admin.rpc("istory_finish_payment_callback", {
      p_receipt_id: receipt.id, p_lease_token: claim.lease_token, p_success: false,
    });
    if (failureError) throw new PaymentUnavailable("Callback retry unavailable");
    return { status: "retry_or_failed" };
  }
}
