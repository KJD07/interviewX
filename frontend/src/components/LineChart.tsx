// Small SVG line chart (no chart library — keeps bundle light). Used by the
// progress page trendlines and the dashboard readiness sparkline.

export default function LineChart({
  data,
  color = "var(--accent)",
  fill,
  height = 72,
  max = 10,
  endDot = false,
}: {
  data: (number | null | undefined)[];
  color?: string;
  fill?: string;
  height?: number;
  max?: number;
  endDot?: boolean;
}) {
  const width = 100; // percentage-based viewBox, scales with container
  const points = data
    .map((v, i) => ({ v, i }))
    .filter((p): p is { v: number; i: number } => typeof p.v === "number");

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-xs"
        style={{ height, color: "var(--ink-faint)" }}
      >
        No data yet
      </div>
    );
  }

  const n = data.length;
  const xFor = (i: number) => (n <= 1 ? width / 2 : (i / (n - 1)) * width);
  const yFor = (v: number) => height - (v / max) * height;

  const pathD = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"} ${xFor(p.i)} ${yFor(p.v)}`)
    .join(" ");
  // Same line, closed along the baseline — the tinted area under the trend.
  const areaD = `${pathD} L ${xFor(points[points.length - 1].i)} ${height} L ${xFor(points[0].i)} ${height} Z`;
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      {fill && <path d={areaD} fill={fill} />}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {endDot && <circle cx={xFor(last.i)} cy={yFor(last.v)} r={1.8} fill={color} />}
    </svg>
  );
}
