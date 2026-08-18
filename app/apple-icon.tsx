import { ImageResponse } from "next/og";

// Home-screen / PWA install icon (also served as apple-touch-icon by Next).
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

// The pulse-V mark on a dark tile, scaled up for the install icon.
export default function AppleIcon() {
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
        }}
      >
        <svg width="360" height="360" viewBox="0 0 32 32" fill="none">
          <path
            d="M2 16 H10 L15 25 L20 7 L25 16 H29"
            stroke="rgb(16,185,129)"
            strokeWidth={2.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="29" cy="16" r="2.4" fill="rgb(16,185,129)" />
        </svg>
      </div>
    ),
    size,
  );
}
