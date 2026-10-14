import { getCategories } from "@/lib/db/queries/storefront/products";
import { requireTenantAccess } from "@/lib/auth/permissions";
import NewProductForm from "./new-product-form";

async function getCategoriesData(tenantId: string) {
  return getCategories(tenantId);
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tenantId = resolvedSearchParams.tenant;

  if (!tenantId) {
    return null;
  }

  await requireTenantAccess(tenantId);
  const categories = await getCategoriesData(tenantId);

  return <NewProductForm tenantId={tenantId} categories={categories} />;
}