"use client";

type EquityCurveChartProps = {
  points: Array<{ timestamp: string; equity: number }>;
};

const WIDTH = 960;
const HEIGHT = 240;
const PADDING = 20;

const toPath = (points: EquityCurveChartProps["points"]) => {
  if (points.length === 0) return "";

  const values = points.map((point) => point.equity);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);

  return points
    .map((point, index) => {
      const x = PADDING + (index / Math.max(points.length - 1, 1)) * (WIDTH - PADDING * 2);
      const y = HEIGHT - PADDING - ((point.equity - min) / span) * (HEIGHT - PADDING * 2);
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
};

const EquityCurveChart = ({ points }: EquityCurveChartProps) => {
  const values = points.map((point) => point.equity);
  const min = values.length > 0 ? Math.min(...values) : 0;
  const max = values.length > 0 ? Math.max(...values) : 0;

  return (
    <div className="rounded-md border border-gray-700 bg-gray-800/70 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-teal-400">Equity Curve</p>
          <p className="text-sm text-gray-500">Capital tracked over every evaluated bar.</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          <p>Min ${min.toFixed(0)}</p>
          <p>Max ${max.toFixed(0)}</p>
        </div>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-60 w-full overflow-visible">
        <defs>
          <linearGradient id="equityGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#0FEDBE" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0FEDBE" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="8" fill="#141414" />
        <path d={toPath(points)} fill="none" stroke="#0FEDBE" strokeWidth="3" strokeLinecap="round" />
      </svg>
    </div>
  );
};

export default EquityCurveChart;

