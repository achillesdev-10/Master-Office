import prisma from "@/lib/db/prisma";

/**
 * Requêtes de `/admin/thèmes` (module 11).
 */

export type ThemeListItem = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  previewUrl: string | null;
  isPremium: boolean;
  category: string | null;
  shopCount: number;
  updatedAt: string;
};

/** Catalogue des thèmes + nombre de boutiques rattachées. */
export async function getThemes(): Promise<ThemeListItem[]> {
  const rows = await prisma.theme.findMany({
    orderBy: [{ isPremium: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      previewUrl: true,
      isPremium: true,
      category: true,
      updatedAt: true,
      _count: { select: { tenants: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    previewUrl: row.previewUrl,
    isPremium: row.isPremium,
    category: row.category,
    shopCount: row._count.tenants,
    updatedAt: row.updatedAt.toISOString(),
  }));
}
