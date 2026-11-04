import { NextRequest, NextResponse } from "next/server";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";
import { externalMediaEnabled } from "@/lib/runtime/config";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_MIME_PREFIXES = ["image/", "audio/", "application/json"];

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;

    const data = await req.formData();
    const file = data.get("file") as Blob | null;
    const metadata = data.get("metadata") as string | null;

    if (!file && !metadata) {
      return NextResponse.json({ error: "No file or metadata provided" }, { status: 400 });
    }

    const visibility = data.get("visibility");
    // IPFS is public and content-addressed. Legacy story metadata already
    // carries explicit intent; missing intent must never imply public consent.
    if ((visibility !== null && visibility !== "public") || (file && metadata) ||
        (file !== null && !(file instanceof Blob)) || (metadata !== null && typeof metadata !== "string")) {
      return NextResponse.json({ error: "Explicit public publication is required" }, { status: 400 });
    }
    if (metadata) {
      if (Buffer.byteLength(metadata, "utf8") > 1024 * 1024) return NextResponse.json({ error: "Metadata exceeds 1MB" }, { status: 413 });
      let parsed: unknown;
      try { parsed = JSON.parse(metadata); } catch { return NextResponse.json({ error: "Invalid metadata JSON" }, { status: 400 }); }
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return NextResponse.json({ error: "Invalid metadata object" }, { status: 400 });
      }
      const intent = "is_public" in parsed ? parsed.is_public : undefined;
      // Old recording tabs always call this endpoint before saving to the DB,
      // even for a private story. A nullable result lets that save proceed,
      // honestly recording that no immutable/public copy was created.
      if (visibility === null && intent === false) {
        return NextResponse.json({ hash: null, url: null, published: false }, { headers: { "Cache-Control": "no-store" } });
      }
      if (visibility !== "public" && intent !== true) {
        return NextResponse.json({ error: "Explicit public publication is required" }, { status: 400 });
      }
      const isPrivate = (value: unknown): boolean => {
        if (!value || typeof value !== "object") return false;
        if (!Array.isArray(value) && "is_public" in value && value.is_public === false) return true;
        return Object.values(value).some(isPrivate);
      };
      if (isPrivate(parsed)) {
        return NextResponse.json({ error: "Private metadata cannot be published" }, { status: 400 });
      }
    } else if (visibility !== "public") {
      return NextResponse.json({ error: "Explicit public publication is required" }, { status: 400 });
    }

    if (!externalMediaEnabled()) return NextResponse.json({ error: "Public IPFS upload is unavailable in this environment" }, { status: 503 });
    const pinataJWT = process.env.PINATA_JWT;
    if (!pinataJWT) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    // Validate file if present
    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: "File too large. Maximum size is 50MB." },
          { status: 400 }
        );
      }

      const fileType = (file as File).type || "";
      if (!ALLOWED_MIME_PREFIXES.some(prefix => fileType.startsWith(prefix))) {
        return NextResponse.json(
          { error: "Invalid file type. Allowed: images, audio, JSON." },
          { status: 400 }
        );
      }
    }

    // We construct the FormData for Pinata specifically
    const pinataFormData = new FormData();

    if (file) {
      pinataFormData.append("file", file);
    } else if (metadata) {
      // If uploading JSON metadata (for NFTs), create a Blob
      const blob = new Blob([metadata], { type: "application/json" });
      pinataFormData.append("file", blob, "metadata.json");
    }

    // Pinata Metadata
    const pinataMetadata = JSON.stringify({
      name: file ? (file as File).name : `metadata-${Date.now()}.json`,
    });
    pinataFormData.append("pinataMetadata", pinataMetadata);

    // Pinata Options
    const pinataOptions = JSON.stringify({
      cidVersion: 1,
    });
    pinataFormData.append("pinataOptions", pinataOptions);

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${pinataJWT}`,
      },
      body: pinataFormData,
    });

    if (!res.ok) {
      console.error("Pinata upload failed:", res.statusText);
      return NextResponse.json({ error: "Failed to upload to IPFS" }, { status: 500 });
    }

    const json = await res.json();
    const ipfsHash = json.IpfsHash;

    return NextResponse.json({
      hash: ipfsHash,
      url: `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}${ipfsHash}`
    });

  } catch (error: unknown) {
    console.error("IPFS upload failed");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
