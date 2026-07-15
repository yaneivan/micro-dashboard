"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ChartSpec } from "@/types";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

interface ChartViewerProps {
  charts: ChartSpec[];
  isVisible: boolean;
}

const chartColors = [
  "#6366f1",
  "#8b5cf6",
  "#a78bfa",
  "#c4b5fd",
  "#818cf8",
  "#60a5fa",
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#f87171",
];

const defaultLayout: Record<string, unknown> = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: {
    family: "Inter, system-ui, sans-serif",
    color: "#374151",
    size: 13,
  },
  margin: { l: 50, r: 20, t: 50, b: 50 },
  xaxis: {
    gridcolor: "rgba(0,0,0,0.05)",
    zerolinecolor: "rgba(0,0,0,0.08)",
  },
  yaxis: {
    gridcolor: "rgba(0,0,0,0.05)",
    zerolinecolor: "rgba(0,0,0,0.08)",
  },
  colorway: chartColors,
  hoverlabel: {
    bgcolor: "white",
    bordercolor: "#e5e7eb",
    font: { size: 13, color: "#111827" },
  },
};

export function ChartViewer({ charts, isVisible }: ChartViewerProps) {
  if (!isVisible || charts.length === 0) return null;

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {charts.map((chart, i) => (
        <ChartCard key={i} chart={chart} index={i} />
      ))}
    </div>
  );
}

function ChartCard({ chart, index }: { chart: ChartSpec; index: number }) {
  const mergedLayout = useMemo(
    () => ({
      ...defaultLayout,
      ...chart.layout,
      title: {
        text: chart.title || (chart.layout?.title as Record<string, string>)?.text || "",
        font: { size: 15, color: "#111827", family: "Inter, system-ui, sans-serif" },
        x: 0.02,
        xanchor: "left" as const,
      },
      height: 320,
    }),
    [chart]
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay: index * 0.15,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      <Card className="overflow-hidden border-0 bg-card shadow-sm hover:shadow-md transition-shadow">
        <div className="p-2">
          <Plot
            data={chart.data}
            layout={mergedLayout}
            config={{
              displayModeBar: true,
              modeBarButtonsToRemove: ["lasso2d", "select2d"],
              displaylogo: false,
              responsive: true,
            }}
            style={{ width: "100%", height: "320px" }}
            useResizeHandler
          />
        </div>
      </Card>
    </motion.div>
  );
}
