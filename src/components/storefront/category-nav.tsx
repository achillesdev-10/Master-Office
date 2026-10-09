"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CategoryListItem } from "@/lib/db/queries/storefront/products";

interface CategoryNavProps {
  categories: CategoryListItem[];
  slug: string;
}

export function CategoryNav({ categories, slug }: CategoryNavProps) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((category) => (
        <Link
          key={category.id}
          href={`/store/${slug}/products?category=${category.slug}`}
          className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:shadow-lg hover:border-primary/50"
        >
          {category.imageUrl ? (
            <div className="relative aspect-video overflow-hidden">
              <img
                src={category.imageUrl}
                alt=""
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            </div>
          ) : (
            <div className="relative aspect-video bg-muted flex items-center justify-center">
              <span className="text-6xl">📦</span>
              <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
            </div>
          )}

          <div className="absolute inset-0 p-4 flex flex-col justify-end">
            <h3 className="text-lg font-semibold text-white">{category.name}</h3>
            <p className="text-sm text-white/80">
              {category.productCount} produit{category.productCount > 1 ? "s" : ""}
            </p>
          </div>

          {category.children.length > 0 && (
            <div className="absolute bottom-4 right-4 text-white/90">
              <ChevronRight className="size-5 group-hover:translate-x-1 transition-transform" />
            </div>
          )}
        </Link>
      ))}
    </div>
  );
}