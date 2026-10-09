import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getStorefrontCategories } from "@/lib/db/queries/storefront/products";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const tenant = await resolveTenant(slug);
    if (!tenant) {
      return NextResponse.json({ error: "Boutique introuvable" }, { status: 404 });
    }

    const categories = await getStorefrontCategories(tenant.id);
    return NextResponse.json(categories);
  } catch (error) {
    console.error("[API] categories error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}