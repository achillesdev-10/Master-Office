import { getCategories } from "@/lib/db/queries/storefront/products";
import { getStorefrontProducts } from "@/lib/db/queries/storefront/products";
import EditProductForm from "./edit-product-form";

async function getProductDetail(tenantId: string, productId: string) {
  const { prisma } = await import("@/lib/db/prisma");
  const product = await prisma.product.findUnique({
    where: { id: productId, tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      shortDescription: true,
      basePrice: true,
      compareAtPrice: true,
      sku: true,
      categoryId: true,
      isActive: true,
      isFeatured: true,
      requiresShipping: true,
      trackInventory: true,
      images: {
        orderBy: { position: "asc" },
        select: { id: true, url: true, altText: true, position: true, isPrimary: true },
      },
      variants: {
        where: { isActive: true },
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          sku: true,
          price: true,
          compareAtPrice: true,
          attributes: true,
          inventory: { select: { quantity: true } },
        },
      },
    },
  });

  if (!product) return null;

  return {
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      attributes: (v.attributes as Record<string, unknown>) ?? {},
    })),
  };
}

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ tenantId: string; id: string }>;
}) {
  const resolvedParams = await params;
  const tenantId = resolvedParams.tenantId;
  const productId = resolvedParams.id;

  const [product, categories] = await Promise.all([
    getProductDetail(tenantId, productId),
    getCategories(tenantId),
  ]);

  if (!product) {
    return null;
  }

  return <EditProductForm tenantId={tenantId} product={product} categories={categories} />;
}