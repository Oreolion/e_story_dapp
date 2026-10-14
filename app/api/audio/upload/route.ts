import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/app/utils/supabase/supabaseAdmin";
import { consumeApiQuota } from "@/lib/apiQuota";
import { validateAuthOrReject, isAuthError, resolveUserId } from "@/lib/auth";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

interface AudioFormat {
  contentType: string;
  extension: string;
}

/**
 * Server-side audio magic byte check.
 * Validates the actual file content rather than the client-supplied MIME type.
 */
function detectAudioFormat(buf: Buffer): AudioFormat | null {
  if (buf.length < 4) return null;
  // WebM / MKV: 0x1A 0x45 0xDF 0xA3
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { contentType: "audio/webm", extension: "webm" };
  // RIFF/WAV: "RIFF" + "WAVE" at offset 8
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) return { contentType: "audio/wav", extension: "wav" };
  // MP3 with ID3 tag: "ID3"
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return { contentType: "audio/mpeg", extension: "mp3" };
  // MP3 sync word: 0xFF 0xFB / 0xFF 0xF3 / 0xFF 0xF2
  if (buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2)) return { contentType: "audio/mpeg", extension: "mp3" };
  // OGG: "OggS"
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return { contentType: "audio/ogg", extension: "ogg" };
  // FLAC: "fLaC"
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return { contentType: "audio/flac", extension: "flac" };
  // M4A/AAC/MP4: ISO Base Media (ftyp box at offset 4)
  if (buf.length >= 12 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70 &&
      (buf.subarray(8, 12).toString("ascii") === "M4A " || buf.subarray(8, 12).toString("ascii") === "M4B ")) return { contentType: "audio/mp4", extension: "m4a" };
  return null;
}

/**
 * POST /api/audio/upload — Upload audio file to Supabase Storage (bypasses RLS)
 *
 * Expects multipart form data with:
 *   - file: audio blob
 *   - userId: the user's ID (validated against auth)
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;
    const resolvedUserId = await resolveUserId(authResult);

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userId = formData.get("userId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Verify ownership
    if (userId && userId !== resolvedUserId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Keep uploads within the same release limit as transcription.
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large (max 25MB)" }, { status: 400 });
    }

    const admin = createSupabaseAdminClient();
    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate via magic bytes (server-side, not client-supplied file.type)
    const audioFormat = detectAudioFormat(buffer);
    if (!audioFormat) {
      return NextResponse.json({ error: "Invalid file type" }, { status: 400 });
    }

    const quota = await consumeApiQuota(admin, resolvedUserId, {
      action: "audio_upload_day",
      maxRequests: 20,
      windowSeconds: 24 * 60 * 60,
    });
    if (!quota.allowed) {
      return NextResponse.json(
        {
          error: quota.unavailable
            ? "Usage controls are temporarily unavailable. Please try again later."
            : "Daily audio upload limit reached. Please try again after the quota resets.",
        },
        {
          status: quota.unavailable ? 503 : 429,
          headers: { "Retry-After": String(quota.retryAfter) },
        }
      );
    }

    const fileName = `${resolvedUserId}/${Date.now()}.${audioFormat.extension}`;

    const { data: uploadData, error: uploadError } = await admin.storage
      .from("story-audio")
      .upload(fileName, buffer, { contentType: audioFormat.contentType });

    if (uploadError) {
      console.error("[API /audio/upload] storage error:", uploadError);
      return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }

    const { data: urlData } = admin.storage
      .from("story-audio")
      .getPublicUrl(uploadData.path);

    return NextResponse.json({
      success: true,
      url: urlData.publicUrl,
      path: uploadData.path,
    });
  } catch (err: unknown) {
    console.error("[API /audio/upload] unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
