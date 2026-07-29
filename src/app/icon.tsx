import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#3b2a8c",
          borderRadius: 96,
        }}
      >
        <div
          style={{
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "#f5df3d",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 150,
            fontWeight: 800,
            color: "#3b2a8c",
          }}
        >
          LTC
        </div>
      </div>
    ),
    { ...size }
  );
}
