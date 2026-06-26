import { ImageResponse } from "next/og";

// Home-screen / PWA install icon (also served as apple-touch-icon by Next).
export const size = { width: 512, height: 512 };
export const contentType = "image/png";

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
        <div
          style={{
            width: 220,
            height: 220,
            borderRadius: "50%",
            background: "rgb(16, 185, 129)",
            boxShadow: "0 0 140px 30px rgba(16, 185, 129, 0.55)",
          }}
        />
      </div>
    ),
    size,
  );
}
