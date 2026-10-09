import { Prisma } from "@prisma/client";
import prisma from "@/lib/db/prisma";

/**
 * Requêtes pour le storefront public (Niveau 1)
 * Toutes les requêtes sont filtrées par tenantId pour l'isolation multi-tenant
 */

export const PRODUCTS_PAGE_SIZE = 20;

export type ProductListFilters = {
  categoryId?: string;
  search?: string;
  featured?: boolean;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "popular";
  page?: number;
  pageSize?: number;
};

export type ProductListItem = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  images: { url: string; altText: string | null }[];
  category: { id: string; name: string; slug: string } | null;
  variants: { id: string; name: string; price: number; attributes: Prisma.JsonValue | null }[];
  inStock: boolean;
};

export type PaginatedProducts = {
  items: ProductListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type CategoryListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  productCount: number;
  children: CategoryListItem[];
};

export type ProductDetail = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: number;
  compareAtPrice: number | null;
  sku: string | null;
  weight: number | null;
  length: number | null;
  width: number | null;
  height: number | null;
  requiresShipping: boolean;
  trackInventory: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  images: { id: string; url: string; altText: string | null; position: number }[];
  variants: {
    id: string;
    name: string;
    sku: string | null;
    price: number;
    compareAtPrice: number | null;
    weight: number | null;
    attributes: Prisma.JsonValue | null;
    inStock: boolean;
    quantity: number;
    images: { url: string; altText: string | null }[];
  }[];
  category: { id: string; name: string; slug: string } | null;
  relatedProducts: ProductListItem[];
};

function buildProductWhere(
  tenantId: string,
  filters: ProductListFilters
): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {
    tenantId,
    isActive: true,
    deletedAt: null,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.featured ? { isFeatured: true } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { description: { contains: filters.search, mode: "insensitive" } },
            { shortDescription: { contains: filters.search, mode: "insensitive" } },
            { sku: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(filters.minPrice !== undefined || filters.maxPrice !== undefined
      ? {
          basePrice: {
            ...(filters.minPrice !== undefined ? { gte: filters.minPrice } : {}),
            ...(filters.maxPrice !== undefined ? { lte: filters.maxPrice } : {}),
          },
        }
      : {}),
  };
  return where;
}

function buildProductOrderBy(
  sort: ProductListFilters["sort"]
): Prisma.ProductOrderByWithRelationInput {
  switch (sort) {
    case "price_asc":
      return { basePrice: "asc" };
    case "price_desc":
      return { basePrice: "desc" };
    case "popular":
      return { orderItems: { _count: "desc" } };
    case "newest":
    default:
      return { createdAt: "desc" };
  }
}

export async function getStorefrontProducts(
  tenantId: string,
  filters: ProductListFilters = {}
): Promise<PaginatedProducts> {
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? PRODUCTS_PAGE_SIZE));

  const where = buildProductWhere(tenantId, filters);
  const orderBy = buildProductOrderBy(filters.sort);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        basePrice: true,
        compareAtPrice: true,
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true, altText: true },
        },
        category: { select: { id: true, name: true, slug: true } },
        variants: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            price: true,
            attributes: true,
            inventory: { select: { quantity: true } },
          },
        },
      },
    }),
  ]);

  const items: ProductListItem[] = products.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    shortDescription: p.shortDescription,
    basePrice: p.basePrice,
    compareAtPrice: p.compareAtPrice,
    images: p.images,
    category: p.category,
    variants: p.variants.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      attributes: v.attributes,
    })),
    inStock: p.variants.some(
      (v) => (v.inventory?.quantity ?? 0) > 0
    ),
  }));

  return {
    items,
    total,
    page,
    pageSize,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getStorefrontCategories(
  tenantId: string
): Promise<CategoryListItem[]> {
  const categories = await prisma.category.findMany({
    where: { tenantId, isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      _count: { select: { products: { where: { isActive: true, deletedAt: null } } } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          description: true,
          imageUrl: true,
          _count: {
            select: { products: { where: { isActive: true, deletedAt: null } } },
          },
        },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    imageUrl: c.imageUrl,
    productCount: c._count.products,
    children: c.children.map((child) => ({
      id: child.id,
      name: child.name,
      slug: child.slug,
      description: child.description,
      imageUrl: child.imageUrl,
      productCount: child._count.products,
      children: [],
    })),
  }));
}

export async function getStorefrontProductBySlug(
  tenantId: string,
  slug: string
): Promise<ProductDetail | null> {
  const product = await prisma.product.findFirst({
    where: { tenantId, slug, isActive: true, deletedAt: null },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      shortDescription: true,
      basePrice: true,
      compareAtPrice: true,
      sku: true,
      weight: true,
      length: true,
      width: true,
      height: true,
      requiresShipping: true,
      trackInventory: true,
      metaTitle: true,
      metaDescription: true,
      images: {
        orderBy: { position: "asc" },
        select: { id: true, url: true, altText: true, position: true },
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
          weight: true,
          attributes: true,
          inventory: { select: { quantity: true, allowBackorder: true } },
          images: {
            orderBy: { position: "asc" },
            select: { url: true, altText: true },
          },
        },
      },
      category: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!product) return null;

  // Produits connexes (même catégorie, excluant le produit courant)
  const relatedProducts = await prisma.product.findMany({
    where: {
      tenantId,
      categoryId: product.category?.id,
      isActive: true,
      deletedAt: null,
      id: { not: product.id },
    },
    take: 4,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      basePrice: true,
      compareAtPrice: true,
      images: {
        where: { isPrimary: true },
        take: 1,
        select: { url: true, altText: true },
      },
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          price: true,
          attributes: true,
          inventory: { select: { quantity: true, allowBackorder: true } },
        },
      },
    },
  });

  return {
    ...product,
    variants: product.variants.map((v) => ({
      ...v,
      inStock:
        v.inventory?.allowBackorder === true ||
        (v.inventory?.quantity ?? 0) > 0,
      quantity: v.inventory?.quantity ?? 0,
    })),
    relatedProducts: relatedProducts.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      shortDescription: p.shortDescription,
      basePrice: p.basePrice,
      compareAtPrice: p.compareAtPrice,
      images: p.images,
      category: p.category,
      variants: p.variants.map((v) => ({
        id: v.id,
        name: v.name,
        price: v.price,
        attributes: v.attributes,
      })),
      inStock: p.variants.some(
        (v) => (v.inventory?.quantity ?? 0) > 0
      ),
    })),
  };
}