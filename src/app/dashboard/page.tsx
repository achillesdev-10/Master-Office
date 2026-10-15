import { getCurrentUser } from "@/lib/auth/permissions";
import { getUserTenants } from "@/lib/db/queries/tenant-detail";
import { redirect } from "next/navigation";

export default async function DashboardRootPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const userTenants = await getUserTenants(user.id);

  if (userTenants.length === 0) {
    redirect("/unauthorized");
  }

  if (userTenants.length === 1) {
    const firstTenant = userTenants[0];
    if (firstTenant) {
      redirect(`/dashboard/${firstTenant.id}`);
    }
  }

  redirect("/unauthorized");
}