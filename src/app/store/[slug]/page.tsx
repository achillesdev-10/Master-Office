import { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { resolveTenant } from "@/lib/tenant/resolve";
import { getStorefrontProducts, getStorefrontCategories } from "@/lib/db/queries/storefront/products";
import { ProductCard } from "@/components/storefront/product-card";
import { CategoryNav } from "@/components/storefront/category-nav";
import { HeroSection } from "@/components/storefront/hero-section";
import { Skeleton } from "@/components/ui/skeleton";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return { title: "Boutique introuvable" };

  return {
    title: tenant.name,
    description: tenant.description ?? undefined,
    openGraph: {
      title: tenant.name,
      description: tenant.description ?? undefined,
      images: tenant.logoUrl ? [tenant.logoUrl] : [],
    },
  };
}

async function FeaturedProducts({ slug }: { slug: string }) {
  const tenant = await resolveTenant(slug);
  if (!tenant) return null;

  const result = await getStorefrontProducts(tenant.id, {
    featured: true,
    pageSize: 8,
    sort: "newest",
  });

  if (result.items.length === 0) {
    return (
      <section className="py-12 px-4">
        <div className="mx-auto max-w-5xl text-center py-16">
          <p className="text-muted-foreground">Aucun produit en vedette pour le moment.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 text-2xl font-semibold">Nos coups de cœur</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} slug={slug} />
          ))}
        </div>
      </div>
    </section>
  );
}

async function CategoriesSection({ slug }: { slug: string }) {
  const tenant = await resolveTenant(slug);
  if (!tenant) return null;

  const categories = await getStorefrontCategories(tenant.id);

  if (categories.length === 0) return null;

  return (
    <section className="py-12 px-4 bg-muted/30">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-6 text-2xl font-semibold">Nos catégories</h2>
        <CategoryNav categories={categories} slug={slug} />
      </div>
    </section>
  );
}

async function NewArrivals({ slug }: { slug: string }) {
  const tenant = await resolveTenant(slug);
  if (!tenant) return null;

  const result = await getStorefrontProducts(tenant.id, {
    pageSize: 8,
    sort: "newest",
  });

  if (result.items.length === 0) return null;

  return (
    <section className="py-12 px-4">
      <div className="mx-auto max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Nouveautés</h2>
          <Link
            href={`/store/${slug}/products`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Voir tout →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} slug={slug} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroFallback() {
  return <Skeleton className="h-64 w-full rounded-xl" />;
}

function ProductsFallback() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default async function StoreHomePage({
  params,
}: {
  params: Params;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  return (
    <div className="flex-1">
      <Suspense fallback={<HeroFallback />}>
        <HeroSection tenant={tenant} />
      </Suspense>

      <Suspense fallback={<ProductsFallback />}>
        <FeaturedProducts slug={slug} />
      </Suspense>

      <Suspense fallback={<ProductsFallback />}>
        <NewArrivals slug={slug} />
      </Suspense>

      <CategoriesSection slug={slug} />
    </div>
  );
}