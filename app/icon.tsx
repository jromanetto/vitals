import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Favicon — the pulse-V mark (see components/brand/logo.tsx) on a dark tile.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#0a0a0b",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 8,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
          <path
            d="M2 16 H10 L15 25 L20 7 L25 16 H29"
            stroke="rgb(16,185,129)"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="29" cy="16" r="2.6" fill="rgb(16,185,129)" />
        </svg>
      </div>
    ),
    size,
  );
}
