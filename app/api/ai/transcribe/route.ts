import { NextRequest, NextResponse } from "next/server";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { validateAuthOrReject, isAuthError } from "@/lib/auth";

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

/** Server-side audio magic byte check (same set as audio/upload). */
function isAudioBuffer(buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return true;
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
      buf.length >= 12 && buf[8] === 0x57 && buf[9] === 0x41 && buf[10] === 0x56 && buf[11] === 0x45) return true;
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  if (buf[0] === 0xff && (buf[1] === 0xfb || buf[1] === 0xf3 || buf[1] === 0xf2)) return true;
  if (buf[0] === 0x4f && buf[1] === 0x67 && buf[2] === 0x67 && buf[3] === 0x53) return true;
  if (buf[0] === 0x66 && buf[1] === 0x4c && buf[2] === 0x61 && buf[3] === 0x43) return true;
  if (buf.length >= 8 && buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return true;
  return false;
}

// Lazy-init to avoid module-scope failures when env var is missing at build time
let _client: ElevenLabsClient | null = null;
function getClient(): ElevenLabsClient {
  if (!_client) {
    _client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
  }
  return _client;
}

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const authResult = await validateAuthOrReject(req);
    if (isAuthError(authResult)) return authResult;

    if (!process.env.ELEVENLABS_API_KEY) {
      console.error("[TRANSCRIBE] ELEVENLABS_API_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 25MB." },
        { status: 400 }
      );
    }

    // Read buffer once; validate via magic bytes (not client-supplied file.type)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!isAudioBuffer(buffer)) {
      return NextResponse.json(
        { error: "Invalid file type. Only audio files are accepted." },
        { status: 400 }
      );
    }

    const fileType = file.type || "audio/webm";
    // Convert the incoming file to a Blob-like object that the SDK accepts
    const audioBlob = new Blob([arrayBuffer], { type: fileType });

    // Call ElevenLabs Scribe Model
    const client = getClient();
    const transcription = await client.speechToText.convert({
      file: audioBlob,
      modelId: "scribe_v1",
      tagAudioEvents: true,
      languageCode: "eng",
      diarize: false,
    });

    // SDK v2.26+ returns a union type — extract text from the response
    const responseText = (transcription as { text?: string }).text ||
                         (typeof transcription === 'string' ? transcription : '');

    if (!responseText) {
      console.error("[TRANSCRIBE] Empty transcription result:", JSON.stringify(transcription).slice(0, 200));
      return NextResponse.json(
        { error: "Transcription returned empty result. Please try again." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text: responseText });

  } catch (error: unknown) {
    console.error("[TRANSCRIBE] Error:", error);
    const message = error instanceof Error ? error.message : String(error);
    // Surface specific SDK errors for debugging
    if (message.includes("api_key") || message.includes("Unauthorized") || message.includes("401")) {
      return NextResponse.json(
        { error: "Transcription service authentication failed. Please check server configuration." },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Failed to transcribe audio. Please try again." },
      { status: 500 }
    );
  }
}
