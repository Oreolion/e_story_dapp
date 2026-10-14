import { NextResponse } from "next/server";

import { parseSha256Fingerprints } from "@/lib/appLinks";

export const dynamic = "force-dynamic";

export async function GET() {
  const fingerprints = parseSha256Fingerprints(
    process.env.ANDROID_APP_LINK_SHA256_CERT_FINGERPRINTS
  );

  return NextResponse.json(
    fingerprints.length
      ? [
          {
            relation: ["delegate_permission/common.handle_all_urls"],
            target: {
              namespace: "android_app",
              package_name: "app.estories.mobile",
              sha256_cert_fingerprints: fingerprints,
            },
          },
        ]
      : [],
    {
      headers: {
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    }
  );
}
