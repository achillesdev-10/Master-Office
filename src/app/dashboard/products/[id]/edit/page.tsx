import { getCategories } from "@/lib/db/queries/storefront/products";
import { getStorefrontProducts } from "@/lib/db/queries/storefront/products";
import { requireTenantAccess } from "@/lib/auth/permissions";
import EditProductForm from "./edit-product-form";

async function getProductData(tenantId: string, productId: string) {
  const result = await getStorefrontProducts(tenantId, { pageSize: 1 });
  return result.items.find(p => p.id === productId);
}

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
  return product;
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const tenantId = resolvedSearchParams.tenant;
  const productId = resolvedParams.id;

  if (!tenantId) {
    return null;
  }

  await requireTenantAccess(tenantId);
  const [product, categories] = await Promise.all([
    getProductDetail(tenantId, productId),
    getCategories(tenantId),
  ]);

  if (!product) {
    return null;
  }

  return <EditProductForm tenantId={tenantId} product={product} categories={categories} />;
}