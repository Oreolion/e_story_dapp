import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "eStories - AI-Powered Sovereign Storytelling";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #b8762a 0%, #6c3dbd 50%, #4c3ee0 100%)",
          fontFamily: "sans-serif",
        }}
      >
        {/* Decorative circles */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -60,
            left: -60,
            width: 250,
            height: 250,
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
          }}
        />

        {/* App name */}
        <div
          style={{
            display: "flex",
            fontSize: 72,
            fontWeight: 800,
            color: "white",
            letterSpacing: "-2px",
            marginBottom: 16,
          }}
        >
          eStories
        </div>

        {/* Tagline */}
        <div
          style={{
            display: "flex",
            fontSize: 28,
            color: "rgba(255,255,255,0.9)",
            marginBottom: 40,
            textAlign: "center",
            maxWidth: 700,
          }}
        >
          AI-Powered Sovereign Storytelling
        </div>

        {/* Feature badges */}
        <div
          style={{
            display: "flex",
            gap: 16,
          }}
        >
          {["AI Transcription", "Blockchain", "NFT Books"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "10px 24px",
                background: "rgba(255,255,255,0.15)",
                borderRadius: 9999,
                color: "white",
                fontSize: 18,
                fontWeight: 600,
                backdropFilter: "blur(10px)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            position: "absolute",
            bottom: 32,
            display: "flex",
            fontSize: 16,
            color: "rgba(255,255,255,0.5)",
          }}
        >
          estories.app
        </div>
      </div>
    ),
    { ...size }
  );
}
