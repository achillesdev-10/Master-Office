import { notFound } from "next/navigation";
import { getTenantById } from "@/lib/db/queries/tenants";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";
import { UsersManager } from "@/components/admin/tenant-detail/users-manager";

/** Onglet « Utilisateurs » : membres, rôles et invitations. */

export default async function TenantUsersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tenant = await getTenantById(id);
  if (!tenant) notFound();

  const members = await getTenantMembers(tenant.id);

  return (
    <section className="rounded-lg border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-base font-semibold">Membres</h2>
        <p className="text-sm text-muted-foreground">
          {members.length} membre{members.length > 1 ? "s" : ""} ·{" "}
          {members.filter((member) => member.role === "ADMIN").length}{" "}
          administrateur
          {members.filter((member) => member.role === "ADMIN").length > 1
            ? "s"
            : ""}
          {" · "}
          Invitation par email via Clerk.
        </p>
      </div>
      <UsersManager tenantId={tenant.id} members={members} />
    </section>
  );
}
