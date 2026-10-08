import { redirect } from "next/navigation";

/**
 * `/admin/tenants/[id]` : point d'entrée de la fiche boutique →
 * premier onglet (module 7). Le 404 est géré par le layout.
 */
export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/tenants/${id}/info`);
}
