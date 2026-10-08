import { AdminShell } from "@/components/admin/admin-shell";
import { requireSuperAdmin } from "@/lib/auth/permissions";

/**
 * Zone /admin :
 *  1. contrôle d'accès serveur en amont du rendu (throw si non connecté,
 *     profil absent, ou rôle ≠ SUPER_ADMIN) ;
 *  2. grille visuelle (sidebar fixe + topbar + contenu scrollable) via
 *     le composant client AdminShell qui porte l'état repli/drawer.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSuperAdmin();

  return <AdminShell>{children}</AdminShell>;
}
