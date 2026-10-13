import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus, Search, Filter, ChevronLeft, ChevronRight, Edit, Trash2, Eye, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getCategories } from "@/lib/db/queries/storefront/products";
import { createCategory, updateCategory, deleteCategory } from "@/lib/actions/storefront/categories";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";
import { toast } from "sonner";

async function getCategoriesData(tenantId: string) {
  const result = await getCategories(tenantId);
  return { categories: result };
}

export default async function CategoriesPage() {
  const user = await getCurrentUser();
  
  if (!user) {
    return null;
  }

  const memberships = await getTenantMembers(user.id);
  const primaryMembership = memberships.find((m) => m.role === "ADMIN") || memberships[0];
  if (!primaryMembership) {
    return null;
  }
  const tenantId = primaryMembership.tenantId;

  await requireTenantAccess(tenantId);

  const { categories } = await getCategoriesData(tenantId);

  async function handleCreateCategory(formData: FormData) {
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const parentId = formData.get("parentId") as string || null;
    const isActive = formData.get("isActive") === "on";

    const result = await createCategory({
      tenantId,
      name,
      slug,
      description,
      parentId,
      isActive,
    });

    if (result.success) {
      toast.success("Catégorie créée avec succès");
    } else {
      toast.error(result.error || "Erreur lors de la création");
    }
  }

  async function handleUpdateCategory(formData: FormData) {
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const slug = formData.get("slug") as string;
    const description = formData.get("description") as string;
    const parentId = formData.get("parentId") as string || null;
    const isActive = formData.get("isActive") === "on";

    const result = await updateCategory({
      id,
      tenantId,
      name,
      slug,
      description,
      parentId,
      isActive,
    });

    if (result.success) {
      toast.success("Catégorie mise à jour");
    } else {
      toast.error(result.error || "Erreur lors de la mise à jour");
    }
  }

  async function handleDeleteCategory(id: string) {
    if (!confirm("Supprimer cette catégorie ? Cette action est irréversible.")) return;

    const result = await deleteCategory({ id, tenantId });
    if (result.success) {
      toast.success("Catégorie supprimée");
    } else {
      toast.error(result.error || "Erreur lors de la suppression");
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Catégories</h1>
          <p className="text-sm text-muted-foreground">Organisez vos produits par catégories</p>
        </div>
        <Button>
          <Plus className="size-4" aria-hidden />
          Nouvelle catégorie
        </Button>
      </header>

      <div className="flex gap-4">
        <div className="relative flex-1 max-w-md">
          <Input
            placeholder="Rechercher une catégorie..."
            className="pl-10"
          />
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        {categories.length === 0 ? (
          <div className="p-8 text-center">
            <h3 className="text-lg font-medium">Aucune catégorie</h3>
            <p className="text-sm text-muted-foreground mt-1">Créez votre première catégorie pour organiser vos produits.</p>
            <Button className="mt-4">
              <Plus className="size-4" aria-hidden />
              Nouvelle catégorie
            </Button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nom</th>
                    <th className="px-4 py-3 font-medium">Parent</th>
                    <th className="px-4 py-3 font-medium">Produits</th>
                    <th className="px-4 py-3 font-medium">Statut</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((category) => (
                    <tr key={category.id} className="border-b last:border-b-0 hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Link href={`/dashboard/categories/${category.id}`} className="font-medium hover:underline">
                          {category.name}
                        </Link>
                        {category.description && (
                          <p className="text-xs text-muted-foreground truncate max-w-xs">{category.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {category.parentId ? "Sous-catégorie" : "Catégorie principale"}
                      </td>
                      <td className="px-4 py-3">{category.productCount} produit{category.productCount > 1 ? "s" : ""}</td>
                      <td className="px-4 py-3">
                        <Badge variant={category.isActive ? "success" : "secondary"}>
                          {category.isActive ? "Actif" : "Inactif"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link href={`/dashboard/categories/${category.id}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Voir">
                            <Eye className="size-4" />
                          </Link>
                          <Link href={`/dashboard/categories/${category.id}/edit`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Modifier">
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </Link>
                          <button className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg" title="Supprimer" onClick={() => handleDeleteCategory(category.id)}>
                            <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}