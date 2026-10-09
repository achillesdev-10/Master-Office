import { Metadata } from "next";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { resolveTenant } from "@/lib/tenant/resolve";
import {
  getStorefrontProducts,
  getStorefrontCategories,
  type ProductListFilters,
} from "@/lib/db/queries/storefront/products";
import { ProductCard } from "@/components/storefront/product-card";
import { CategoryNav } from "@/components/storefront/category-nav";
import { Skeleton } from "@/components/ui/skeleton";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{
  category?: string;
  search?: string;
  sort?: string;
  minPrice?: string;
  maxPrice?: string;
  page?: string;
}>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) return { title: "Boutique introuvable" };

  const sp = await searchParams;
  const category = sp.category;
  const search = sp.search;

  let title = "Tous les produits";
  if (category) title = `Catégorie : ${category}`;
  if (search) title = `Recherche : ${search}`;

  return {
    title: `${title} - ${tenant.name}`,
    description: `Découvrez notre catalogue de produits${category ? ` dans la catégorie ${category}` : ""}${search ? ` pour "${search}"` : ""}.`,
  };
}

async function ProductGrid({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tenant = await resolveTenant(slug);
  if (!tenant) return null;

  const categoryId = sp.category || undefined;
  const search = sp.search || undefined;
  const sort = (sp.sort as ProductListFilters["sort"]) || "newest";
  const minPrice = sp.minPrice ? parseInt(sp.minPrice) : undefined;
  const maxPrice = sp.maxPrice ? parseInt(sp.maxPrice) : undefined;
  const page = parseInt(sp.page || "1");

  const result = await getStorefrontProducts(tenant.id, {
    categoryId,
    search,
    sort,
    minPrice,
    maxPrice,
    page,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {result.total} produit{result.total > 1 ? "s" : ""} trouvé{result.total > 1 ? "s" : ""}
            {result.pageCount > 1 && ` - Page ${result.page} sur ${result.pageCount}`}
          </p>
        </div>
        {result.pageCount > 1 && (
          <Pagination currentPage={result.page} pageCount={result.pageCount} searchParams={sp} />
        )}
      </div>

      {result.items.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted-foreground">Aucun produit ne correspond à vos critères.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {result.items.map((product) => (
            <ProductCard key={product.id} product={product} slug={slug} />
          ))}
        </div>
      )}

      {result.pageCount > 1 && (
        <Pagination currentPage={result.page} pageCount={result.pageCount} searchParams={sp} />
      )}
    </div>
  );
}

function Pagination({
  currentPage,
  pageCount,
  searchParams,
}: {
  currentPage: number;
  pageCount: number;
  searchParams: { [key: string]: string | undefined };
}) {
  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key !== "page" && value) baseParams.set(key, value);
  }
  const baseQuery = baseParams.toString();

  const pages = [];
  const showPages = 5;
  let start = Math.max(1, currentPage - Math.floor(showPages / 2));
  const end = Math.min(pageCount, start + showPages - 1);
  if (end - start + 1 < showPages) {
    start = Math.max(1, end - showPages + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <nav className="flex items-center justify-center gap-2" aria-label="Pagination">
      {currentPage > 1 && (
        <a
          href={`?${baseQuery}${baseQuery ? "&" : ""}page=${currentPage - 1}`}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
        >
          Précédent
        </a>
      )}
      {start > 1 && (
        <>
          <a href={`?${baseQuery}`} className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md">
            1
          </a>
          {start > 2 && <span className="px-2 text-muted-foreground">…</span>}
        </>
      )}
      {pages.map((page) => (
        <a
          key={page}
          href={`?${baseQuery}${baseQuery ? "&" : ""}page=${page}`}
          className={`px-3 py-2 text-sm font-medium rounded-md ${
            page === currentPage
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
          aria-current={page === currentPage ? "page" : undefined}
        >
          {page}
        </a>
      ))}
      {end < pageCount && (
        <>
          {end < pageCount - 1 && <span className="px-2 text-muted-foreground">…</span>}
          <a
            href={`?${baseQuery}${baseQuery ? "&" : ""}page=${pageCount}`}
            className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
          >
            {pageCount}
          </a>
        </>
      )}
      {currentPage < pageCount && (
        <a
          href={`?${baseQuery}${baseQuery ? "&" : ""}page=${currentPage + 1}`}
          className="px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-md"
        >
          Suivant
        </a>
      )}
    </nav>
  );
}

function FiltersFallback() {
  return <Skeleton className="h-32 w-full" />;
}

function ProductsFallback() {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {[...Array(8)].map((_, i) => (
        <Skeleton key={i} className="h-72 w-full rounded-lg" />
      ))}
    </div>
  );
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const tenant = await resolveTenant(slug);
  if (!tenant) notFound();

  return (
    <div className="flex-1 py-8 px-4">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Notre catalogue</h1>
          <p className="mt-2 text-muted-foreground">
            Découvrez tous nos produits disponibles
          </p>
        </header>

        <div className="lg:grid lg:grid-cols-4 lg:gap-8">
          <aside className="lg:col-span-1">
            <Suspense fallback={<FiltersFallback />}>
              <ProductFilters slug={slug} searchParams={searchParams} />
            </Suspense>
          </aside>

          <main className="lg:col-span-3">
            <Suspense fallback={<ProductsFallback />}>
              <ProductGrid slug={slug} searchParams={searchParams} />
            </Suspense>
          </main>
        </div>

        <section className="mt-16">
          <Suspense fallback={<ProductsFallback />}>
            <CategoriesSection slug={slug} />
          </Suspense>
        </section>
      </div>
    </div>
  );
}

async function ProductFilters({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const tenant = await resolveTenant(slug);
  if (!tenant) return null;

  const categories = await getStorefrontCategories(tenant.id);

  return (
    <div className="sticky top-24 space-y-6 p-4 bg-muted/30 rounded-xl border">
      <h2 className="text-lg font-semibold">Filtres</h2>

      {/* Recherche */}
      <div>
        <label htmlFor="search" className="block text-sm font-medium mb-2">
          Rechercher
        </label>
        <input
          type="search"
          id="search"
          defaultValue={sp.search || ""}
          placeholder="Nom, description..."
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => {
            const params = new URLSearchParams(sp);
            if (e.target.value) params.set("search", e.target.value);
            else params.delete("search");
            params.delete("page");
            window.location.href = `?${params.toString()}`;
          }}
        />
      </div>

      {/* Catégories */}
      {categories.length > 0 && (
        <div>
          <label className="block text-sm font-medium mb-2">Catégories</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="category"
                defaultChecked={!sp.category}
                onChange={() => {
                  const params = new URLSearchParams(sp);
                  params.delete("category");
                  params.delete("page");
                  window.location.href = `?${params.toString()}`;
                }}
                className="text-primary" />
              <span className="text-sm">Toutes</span>
              <span className="text-xs text-muted-foreground ml-auto">
                {categories.reduce((sum, c) => sum + c.productCount, 0)}
              </span>
            </label>
            {categories.map((cat) => (
              <label key={cat.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="category"
                  value={cat.slug}
                  defaultChecked={sp.category === cat.slug}
                  onChange={() => {
                    const params = new URLSearchParams(sp);
                    params.set("category", cat.slug);
                    params.delete("page");
                    window.location.href = `?${params.toString()}`;
                  }}
                  className="text-primary" />
                <span className="text-sm truncate">{cat.name}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {cat.productCount}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Tri */}
      <div>
        <label htmlFor="sort" className="block text-sm font-medium mb-2">
          Trier par
        </label>
        <select
          id="sort"
          defaultValue={sp.sort || "newest"}
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          onChange={(e) => {
            const params = new URLSearchParams(sp);
            if (e.target.value === "newest") params.delete("sort");
            else params.set("sort", e.target.value);
            params.delete("page");
            window.location.href = `?${params.toString()}`;
          }}
        >
          <option value="newest">Plus récents</option>
          <option value="price_asc">Prix croissant</option>
          <option value="price_desc">Prix décroissant</option>
          <option value="popular">Plus populaires</option>
        </select>
      </div>

      {/* Prix */}
      <div>
        <label className="block text-sm font-medium mb-2">Prix</label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min"
            defaultValue={sp.minPrice || ""}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            onChange={(e) => {
              const params = new URLSearchParams(sp);
              if (e.target.value) params.set("minPrice", e.target.value);
              else params.delete("minPrice");
              params.delete("page");
              window.location.href = `?${params.toString()}`;
            }}
          />
          <input
            type="number"
            placeholder="Max"
            defaultValue={sp.maxPrice || ""}
            className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
            onChange={(e) => {
              const params = new URLSearchParams(sp);
              if (e.target.value) params.set("maxPrice", e.target.value);
              else params.delete("maxPrice");
              params.delete("page");
              window.location.href = `?${params.toString()}`;
            }}
          />
        </div>
      </div>
    </div>
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