import { Badge } from "@/components/ui/badge";

/**
 * Badge de statut d'une boutique (liste, fiche, onglets) —
 * libellés et couleurs centralisés.
 */

type StatusKey = "DRAFT" | "ACTIVE" | "SUSPENDED" | "ARCHIVED";

const STATUS_BADGES: Record<
  StatusKey,
  { label: string; variant: "info" | "success" | "destructive" | "secondary" }
> = {
  DRAFT: { label: "Brouillon", variant: "info" },
  ACTIVE: { label: "Active", variant: "success" },
  SUSPENDED: { label: "Suspendue", variant: "destructive" },
  ARCHIVED: { label: "Archivée", variant: "secondary" },
};

export function TenantStatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status as StatusKey] ?? {
    label: status,
    variant: "secondary" as const,
  };
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
