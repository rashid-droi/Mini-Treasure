"use client";

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  type ChartOptions,
} from "chart.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const GOLD = "#f5c518";

export default function DashboardActivityChart({
  labels,
  data,
}: {
  labels: string[];
  data: number[];
}) {
  const chartData = {
    labels,
    datasets: [
      {
        label: "Answers",
        data,
        borderColor: GOLD,
        backgroundColor: (ctx: { chart: ChartJS }) => {
          const { ctx: c, chartArea } = ctx.chart;
          if (!chartArea) return "rgba(245,197,24,0.15)";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, "rgba(245,197,24,0.30)");
          g.addColorStop(1, "rgba(245,197,24,0)");
          return g;
        },
        fill: true,
        tension: 0.4,
        borderWidth: 2.5,
        pointRadius: 3,
        pointBackgroundColor: GOLD,
        pointHoverRadius: 5,
      },
    ],
  };

  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: "#2b2b2b",
        padding: 10,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (item) => ` ${item.parsed.y} answers`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: "#a1a1aa", font: { size: 12 } },
      },
      y: {
        beginAtZero: true,
        grid: { color: "#f1f1f4" },
        border: { display: false },
        ticks: { color: "#a1a1aa", font: { size: 12 }, precision: 0 },
      },
    },
  };

  return (
    <div className="h-72">
      <Line data={chartData} options={options} />
    </div>
  );
}
