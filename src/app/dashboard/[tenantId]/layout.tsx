import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getUserTenants } from "@/lib/db/queries/tenant-detail";
import { redirect } from "next/navigation";

export default async function TenantDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantId: string }>;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const userTenants = await getUserTenants(user.id);

  if (userTenants.length === 0) {
    redirect("/unauthorized");
  }

  const resolvedParams = await params;
  const tenantId = resolvedParams.tenantId;

  const userTenant = userTenants.find((t) => t.id === tenantId);
  if (!userTenant) {
    redirect("/unauthorized");
  }

  await requireTenantAccess(tenantId);

  return <DashboardShell tenantId={tenantId} userMemberships={userTenants}>{children}</DashboardShell>;
}