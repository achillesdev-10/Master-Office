import { NextRequest, NextResponse } from "next/server";
import { resolveTenant } from "@/lib/tenant/resolve";
import {
  getStorefrontProducts,
  type ProductListFilters,
} from "@/lib/db/queries/storefront/products";

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

    const searchParams = request.nextUrl.searchParams;
    const categoryId = searchParams.get("categoryId") || undefined;
    const search = searchParams.get("search") || undefined;
    const featured = searchParams.get("featured") === "true";
    const minPrice = searchParams.get("minPrice") ? parseInt(searchParams.get("minPrice")!) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? parseInt(searchParams.get("maxPrice")!) : undefined;
    const sort =
      (searchParams.get("sort") as ProductListFilters["sort"]) || "newest";
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const result = await getStorefrontProducts(tenant.id, {
      categoryId,
      search,
      featured,
      minPrice,
      maxPrice,
      sort,
      page,
      pageSize,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("[API] products error:", error);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}