import { getCategories } from "@/lib/db/queries/storefront/products";
import NewProductForm from "./new-product-form";

async function getCategoriesData(tenantId: string) {
  return getCategories(tenantId);
}

export default async function NewProductPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const resolvedParams = await params;
  const tenantId = resolvedParams.tenantId;
  const categories = await getCategoriesData(tenantId);

  return <NewProductForm tenantId={tenantId} categories={categories} />;
}