import { ImageResponse } from "next/og";

/**
 * Social share card. Generated rather than checked in as a binary so the
 * wording stays editable alongside the rest of the copy.
 */
export const runtime = "edge";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f2f0ea",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: "44px",
              height: "44px",
              borderRadius: "10px",
              background: "#0c0c0b",
            }}
          />
          <div style={{ fontSize: "34px", fontWeight: 700, color: "#0c0c0b" }}>
            EvaluLabs
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: "70px",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#0c0c0b",
              letterSpacing: "-0.02em",
            }}
          >
            Practice with questions
          </div>
          <div
            style={{
              fontSize: "70px",
              fontWeight: 700,
              lineHeight: 1.05,
              color: "#0c0c0b",
              letterSpacing: "-0.02em",
            }}
          >
            people were actually asked.
          </div>
          <div style={{ fontSize: "30px", color: "#5c5b54", marginTop: "26px" }}>
            AI mock interviews · Verified questions · Instant scoring
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
