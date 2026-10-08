"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { GrowthPoint } from "@/lib/db/queries/dashboard";
import { cn } from "@/lib/utils";

type TenantsGrowthChartProps = {
  data: GrowthPoint[];
  className?: string;
};

/** Props injectées par <Tooltip content={…} /> (recharts). */
type GrowthTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: GrowthPoint }>;
};

function GrowthTooltip({ active, payload }: GrowthTooltipProps) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  return (
    <div className="rounded-md border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <p className="text-xs font-medium">{point.label}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-medium tabular-nums text-foreground">
          {point.created}
        </span>{" "}
        nouvelle(s) boutique(s)
      </p>
      <p className="text-xs text-muted-foreground">
        Total :{" "}
        <span className="font-medium tabular-nums text-foreground">
          {point.total}
        </span>
      </p>
    </div>
  );
}

/**
 * Graphique d'aire des créations de boutiques sur les N derniers mois.
 * Couleurs pilotées par les tokens `--chart-*` / `--border` (voir globals.css),
 * donc automatiquement adaptées au thème clair et sombre.
 */
export function TenantsGrowthChart({
  data,
  className,
}: TenantsGrowthChartProps) {
  if (data.length === 0) {
    return (
      <p className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Aucune donnée à afficher.
      </p>
    );
  }

  return (
    <div
      className={cn("h-72 w-full text-muted-foreground sm:h-80", className)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
        >
          <CartesianGrid
            stroke="currentColor"
            strokeOpacity={0.3}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fill: "currentColor", fontSize: 12 }}
            interval="preserveStartEnd"
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            width={48}
            tick={{ fill: "currentColor", fontSize: 12 }}
          />
          <Tooltip
            cursor={{ stroke: "currentColor", strokeOpacity: 0.4 }}
            content={<GrowthTooltip />}
          />
          <Area
            type="monotone"
            dataKey="created"
            name="Nouvelles boutiques"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
