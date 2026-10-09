import { Metadata } from "next";
import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getStorefrontProductBySlug } from "@/lib/db/queries/storefront/products";
import { ProductDetailClient } from "@/components/storefront/product-detail-client";
import { Skeleton } from "@/components/ui/skeleton";

type Params = Promise<{ slug: string; id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug, id } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return { title: "Boutique introuvable" };

  // On ne peut pas faire de fetch async ici pour les métadonnées détaillées
  // Le composant client gérera le titre via useEffect
  return {
    title: `Produit - ${tenant.name}`,
    description: tenant.description ?? undefined,
  };
}

function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <Skeleton className="h-8 w-3/4 mb-8" />
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <Skeleton className="h-96 w-full rounded-xl" />
          <div className="grid gap-2 sm:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-6 w-32" />
          </div>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
      <div className="mt-12 grid gap-8 lg:grid-cols-2">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
}: {
  params: Params;
}) {
  const { slug, id } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  const product = await getStorefrontProductBySlug(tenant.id, id);
  if (!product) notFound();

  return (
    <div className="flex-1 py-8 px-4">
      <ProductDetailClient
        initialProduct={product}
        tenant={tenant}
      />
    </div>
  );
}