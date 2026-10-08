import { NextResponse, type NextRequest } from "next/server";
import { requireSuperAdmin } from "@/lib/auth/permissions";
import {
  AUDIT_EXPORT_LIMIT,
  getAuditLogRowsForExport,
} from "@/lib/db/queries/audit";

/**
 * `GET /api/audit-logs/export` — export CSV du journal d’activité (module 12).
 * Protégé par `requireSuperAdmin()` (403 sinon) ; mêmes filtres que la page.
 */

/** Échappement CSV (guillemets doublés, cellules toujours entre quotes). */
function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? "" : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch {
    return NextResponse.json(
      { error: "Accès refusé : rôle Super Admin requis." },
      { status: 403 },
    );
  }

  const params = request.nextUrl.searchParams;
  const filters = {
    action: params.get("action") ?? undefined,
    email: params.get("email") ?? undefined,
    entity: params.get("entity") ?? undefined,
    tenantId: params.get("tenantId") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };

  const rows = await getAuditLogRowsForExport(filters);

  const header = [
    "Date",
    "Action",
    "Entité",
    "ID cible",
    "Utilisateur",
    "Rôle",
    "Boutique",
    "Slug",
    "IP",
    "Métadonnées",
  ]
    .map(csvCell)
    .join(",");

  const lines = rows.map((row) =>
    [
      new Date(row.createdAt).toLocaleString("fr-FR"),
      row.action,
      row.entity ?? "",
      row.entityId ?? "",
      row.user?.email ?? "",
      row.user?.role ?? "",
      row.tenant?.name ?? "",
      row.tenant?.slug ?? "",
      row.ip ?? "",
      row.metadata === null ? "" : JSON.stringify(row.metadata),
    ]
      .map(csvCell)
      .join(","),
  );

  const truncated = rows.length >= AUDIT_EXPORT_LIMIT;
  const note = truncated
    ? `${csvCell(`Export limité aux ${AUDIT_EXPORT_LIMIT} entrées les plus récentes.`)}\r\n`
    : "";

  const csv = `\uFEFF${note}${[header, ...lines].join("\r\n")}\r\n`;
  const filename = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
