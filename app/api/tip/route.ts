import { NextResponse } from "next/server";

/**
 * DEPRECATED — /api/tip
 *
 * Historical route that used a server-side signer to call tipCreator().
 * This is a security footgun: if a server private key ever shipped, any
 * authenticated user could drain the server wallet.
 *
 * Tips now happen fully client-side via the user's wallet — see
 * `app/hooks/useStoryProtocol.ts` and the UI in `StoryPageClient.tsx`.
 * Post-tip notifications are best created from the client after a
 * successful transaction hash, by calling the notification insert
 * through an admin-client API route scoped to the sender's user id.
 */
export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been retired. Tips are now signed client-side." },
    { status: 410 }
  );
}

export async function GET() {
  return NextResponse.json({ error: "Gone" }, { status: 410 });
}
