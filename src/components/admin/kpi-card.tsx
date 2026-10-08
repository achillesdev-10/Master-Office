import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, formatPercent } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/** Variation d'un KPI par rapport à la période précédente. */
export type KpiVariation = {
  /** Écart absolu (+3, −1, 0…) */
  delta: number;
  /** Écart en % ; null si la période précédente était à 0 */
  percent: number | null;
};

type Trend = "up" | "down" | "flat";

type KpiCardProps = {
  title: string;
  /** Valeur déjà formatée ("1 240", "899 €", "0"…) */
  value: string;
  icon: LucideIcon;
  variation?: KpiVariation | null;
  /** Texte secondaire sous la valeur (contexte, statut du stub…) */
  hint?: string;
  /** Libellé de la comparaison (défaut : « vs mois dernier ») */
  comparisonLabel?: string;
  className?: string;
};

const TREND_COLORS: Record<Trend, string> = {
  up: "text-emerald-600 dark:text-emerald-500",
  down: "text-rose-600 dark:text-rose-500",
  flat: "text-muted-foreground",
};

function getTrend(delta: number): Trend {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

/**
 * Carte KPI réutilisable : titre, valeur mise en avant, variation
 * fléchée et icône. Présentation pure (aucun état) → rendue côté serveur.
 */
export function KpiCard({
  title,
  value,
  icon: Icon,
  variation,
  hint,
  comparisonLabel = "vs mois dernier",
  className,
}: KpiCardProps) {
  const trend = variation ? getTrend(variation.delta) : null;
  const TrendIcon =
    trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;

  return (
    <article
      className={cn(
        "flex flex-col rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-secondary-foreground"
        >
          <Icon className="size-4" />
        </span>
      </div>

      <p className="mt-3 text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
        {value}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {trend && variation && (
          <span
            className={`inline-flex items-center gap-1 font-medium ${TREND_COLORS[trend]}`}
          >
            <TrendIcon className="size-3.5" aria-hidden />
            <span className="tabular-nums">
              {variation.delta > 0 ? `+${variation.delta}` : variation.delta}
              {variation.percent !== null &&
                ` (${formatPercent(variation.percent)})`}
            </span>
            <span className="font-normal text-muted-foreground">
              {comparisonLabel}
            </span>
          </span>
        )}
        {hint && (
          <span className="text-muted-foreground italic">{hint}</span>
        )}
      </div>
    </article>
  );
}

/** Skeleton d'une carte KPI (fallback Suspense). */
export function KpiCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="size-9 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-24" />
      <Skeleton className="mt-3 h-3 w-36" />
    </div>
  );
}
