import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getOrCreateCart, getCartDetail } from "@/lib/db/queries/storefront/cart";

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

    // Pour les paniers anonymes, on utilise un sessionId passé en header ou query param
    const sessionId = request.headers.get("x-session-id") || request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID requis" }, { status: 400 });
    }

    const cart = await getOrCreateCart(tenant.id, null, sessionId);
    if (!cart) {
      return NextResponse.json({ error: "Impossible de créer le panier" }, { status: 500 });
    }

    const cartDetail = await getCartDetail(cart.id);
    if (!cartDetail) {
      return NextResponse.json({ error: "Panier introuvable" }, { status: 404 });
    }

    return NextResponse.json(cartDetail);
  } catch (error) {
    console.error("[API] cart get error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}