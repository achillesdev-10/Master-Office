import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getStorefrontProductBySlug } from "@/lib/db/queries/storefront/products";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; id: string }> }
) {
  try {
    const { slug, id } = await params;
    const tenant = await resolveTenant(slug);
    if (!tenant) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    // L'id peut être un slug ou un CUID
    const product = await getStorefrontProductBySlug(tenant.id, id);

    if (!product) {
      return NextResponse.json({ error: "Produit introuvable" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("[API] product detail error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}