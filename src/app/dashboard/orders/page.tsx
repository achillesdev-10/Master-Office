import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, Eye, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { getOrdersByTenant } from "@/lib/db/queries/tenant-detail";
import { updateOrderStatus, cancelOrder } from "@/lib/actions/storefront/orders";
import { requireTenantAccess } from "@/lib/auth/permissions";

interface OrderItem {
  id: string;
  customerName: string;
  customerPhone: string | null;
  total: number;
  status: string;
  createdAt: string;
  itemCount: number;
}

async function getOrdersData(tenantId: string, page: number, pageSize: number, search: string, statusFilter: string) {
  const result = await getOrdersByTenant(tenantId, { pageSize: pageSize * page });
  
  const filteredOrders: OrderItem[] = result.items.filter((o) => {
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  return { orders: paginatedOrders, totalPages, total: filteredOrders.length };
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string; tenant?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const tenantId = resolvedSearchParams.tenant;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const statusFilter = resolvedSearchParams.status || "all";
  const pageSize = 10;

  if (!tenantId) {
    return null;
  }

  await requireTenantAccess(tenantId);

  const { orders, totalPages, total } = await getOrdersData(tenantId, page, pageSize, search, statusFilter);

  const statusColors: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: "bg-blue-100", text: "text-blue-700" },
    CONFIRMED: { bg: "bg-green-100", text: "text-green-700" },
    PROCESSING: { bg: "bg-purple-100", text: "text-purple-700" },
    SHIPPED: { bg: "bg-amber-100", text: "text-amber-700" },
    DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700" },
    REFUNDED: { bg: "bg-muted", text: "text-muted-foreground" },
  };

  const statusLabels: Record<string, string> = {
    PENDING: "Nouvelle",
    CONFIRMED: "Confirmée",
    PROCESSING: "En préparation",
    SHIPPED: "Expédiée",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
    REFUNDED: "Remboursée",
  };

  const simpleStatusFlow: Record<string, string[]> = {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["PROCESSING", "CANCELLED"],
    PROCESSING: ["SHIPPED", "CANCELLED"],
    SHIPPED: ["DELIVERED", "CANCELLED"],
    DELIVERED: [],
    CANCELLED: [],
    REFUNDED: [],
  };

  async function handleStatusUpdate(orderId: string, newStatus: string) {
    const result = await updateOrderStatus({ id: orderId, tenantId, status: newStatus as "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED" | "REFUNDED" });
    return result;
  }

  async function handleCancel(orderId: string) {
    const result = await cancelOrder(tenantId, orderId);
    return result;
  }

  const buildUrl = (params: Record<string, string>) => {
    const urlParams = new URLSearchParams();
    urlParams.set("tenant", tenantId);
    Object.entries(params).forEach(([key, value]) => {
      if (value) urlParams.set(key, value);
    });
    return `?${urlParams.toString()}`;
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
          <p className="text-sm text-muted-foreground">Suivez et gérez vos commandes ({formatNumber(total)})</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" aria-hidden />
          <Input
            placeholder="Rechercher commande, client..."
            value={search}
            onChange={(e) => window.location.href = buildUrl({ search: e.target.value, page: "1", status: statusFilter })}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => window.location.href = buildUrl({ status: e.target.value, page: "1", search })}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="PENDING">Nouvelles</option>
            <option value="CONFIRMED">Confirmées</option>
            <option value="PROCESSING">En préparation</option>
            <option value="SHIPPED">Expédiées</option>
            <option value="DELIVERED">Livrées</option>
            <option value="CANCELLED">Annulées</option>
            <option value="REFUNDED">Remboursées</option>
          </select>
          <Button variant="outline" className="hidden sm:flex" disabled>
            Filtres
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Commande</th>
                <th className="px-4 py-3 font-medium">Client</th>
                <th className="px-4 py-3 font-medium">Articles</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const colors = statusColors[order.status] || statusColors.PENDING;
                const availableTransitions = simpleStatusFlow[order.status] || [];
                return (
                  <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${order.id}?tenant=${tenantId}`} className="font-mono font-medium hover:underline">
                        #{order.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone || "—"}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{order.itemCount} article{order.itemCount > 1 ? "s" : ""}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatNumber(order.total)} FCFA</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                        {statusLabels[order.status] || order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/orders/${order.id}?tenant=${tenantId}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Voir détails">
                          <Eye className="size-4" />
                        </Link>
                        {availableTransitions.length > 0 && (
                          <form action={async (formData) => {
                            "use server";
                            const result = await handleStatusUpdate(order.id, formData.get("status") as string);
                            if (!result.success) {
                              // Error handled by form
                            }
                          }}>
                            <select
                              name="status"
                              defaultValue={order.status}
                              onChange={(e) => e.currentTarget.form?.requestSubmit()}
                              className={`px-2 py-1 text-xs rounded border ${colors.bg} ${colors.text} bg-transparent`}
                            >
                              {availableTransitions.map((status) => (
                                <option key={status} value={status}>{statusLabels[status]}</option>
                              ))}
                            </select>
                          </form>
                        )}
                        {["PENDING", "CONFIRMED", "PROCESSING"].includes(order.status) && (
                          <form action={async () => {
                            "use server";
                            const result = await handleCancel(order.id);
                            if (!result.success) {
                              // Error handled by form
                            }
                          }}>
                            <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10">
                              <X className="size-3.5 mr-1" /> Annuler
                            </Button>
                          </form>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} — {total} commande{total > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => window.location.href = buildUrl({ page: String(page - 1), search, status: statusFilter })}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => window.location.href = buildUrl({ page: String(page + 1), search, status: statusFilter })}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}