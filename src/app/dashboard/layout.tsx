import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";
import { notFound, redirect } from "next/navigation";

/**
 * Layout du dashboard propriétaire — protégé par requireTenantAccess.
 * Récupère les boutiques de l'utilisateur et gère la sélection.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Récupère les memberships de l'utilisateur
  const memberships = await getTenantMembers(user.id);
  
  if (memberships.length === 0) {
    redirect("/unauthorized");
  }

  // Pour l'instant, on prend le premier tenant (ADMIN ou MEMBER)
  // Dans une vraie app, on aurait un sélecteur dans le shell
  const primaryMembership = memberships.find((m) => m.role === "ADMIN") || memberships[0];
  if (!primaryMembership) {
    redirect("/unauthorized");
  }
  const tenantId = primaryMembership.tenantId;

  // Valide l'accès au tenant
  await requireTenantAccess(tenantId);

  return <DashboardShell tenantId={tenantId} userMemberships={memberships}>{children}</DashboardShell>;
}