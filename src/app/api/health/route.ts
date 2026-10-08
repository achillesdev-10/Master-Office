import { NextResponse } from "next/server";
import prisma from "@/lib/db/prisma";

/**
 * `GET /api/health` — healthcheck de la plateforme (module 15).
 *
 * Public et volontairement minimal : vérifie la connexion PostgreSQL et
 * renvoie un statut JSON. Utilisable par le CI, Vercel et les sondes
 * de supervision. Aucune donnée sensible n'est exposée.
 */

export const dynamic = "force-dynamic";

export async function GET() {
  const timestamp = new Date().toISOString();

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "up", timestamp },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[health] base de données injoignable", error);
    return NextResponse.json(
      { status: "degraded", database: "down", timestamp },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
