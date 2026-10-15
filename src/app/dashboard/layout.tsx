import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getUserTenants, type UserTenant } from "@/lib/db/queries/tenant-detail";
import { redirect } from "next/navigation";

/**
 * Layout du dashboard propriétaire — protégé par requireTenantAccess.
 * Récupère les boutiques de l'utilisateur et gère la sélection.
 */
export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId?: string }>;
}) {
  const user = await getCurrentUser();
  
  if (!user) {
    redirect("/login");
  }

  // Récupère les tenants de l'utilisateur
  const userTenants = await getUserTenants(user.id);
  
  if (userTenants.length === 0) {
    redirect("/unauthorized");
  }

  const resolvedParams = await params;
  const tenantId = resolvedParams.tenantId;
  
  // Si pas de tenantId (page racine /dashboard), redirige vers le premier tenant
  if (!tenantId) {
    const firstTenant = userTenants[0];
    if (firstTenant) {
      redirect(`/dashboard/${firstTenant.id}`);
    }
    redirect("/unauthorized");
  }
  
  // Vérifie que l'utilisateur a accès à ce tenant
  const userTenant = userTenants.find((t) => t.id === tenantId);
  if (!userTenant) {
    redirect("/unauthorized");
  }

  // Valide l'accès au tenant (SUPER_ADMIN ou membre)
  await requireTenantAccess(tenantId);

  return <DashboardShell tenantId={tenantId} userMemberships={userTenants}>{children}</DashboardShell>;
}