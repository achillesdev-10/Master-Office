import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Truck, X, RotateCcw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { getOrdersByTenant } from "@/lib/db/queries/tenant-detail";
import { updateOrderStatus, cancelOrder } from "@/lib/actions/storefront/orders";
import { requireTenantAccess, getCurrentUser } from "@/lib/auth/permissions";
import { getTenantMembers } from "@/lib/db/queries/tenant-detail";

async function getOrdersData(tenantId: string, page: number, pageSize: number, search: string, statusFilter: string) {
  const result = await getOrdersByTenant(tenantId, { pageSize: pageSize * page });
  
  let filteredOrders = result.items.filter((o) => {
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / 10);
  const paginatedOrders = filteredOrders.slice((page - 1) * 10, page * 10);

  return { orders: paginatedOrders, totalPages, total: filteredOrders.length };
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}) {
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

  const resolvedSearchParams = await searchParams;
  const page = parseInt(resolvedSearchParams.page || "1", 10);
  const search = resolvedSearchParams.search || "";
  const statusFilter = resolvedSearchParams.status || "all";

  const { orders, totalPages, total } = await getOrdersData(tenantId, page, 10, search, statusFilter);

  const statusColors: Record<string, { bg: string; text: string }> = {
    NEW: { bg: "bg-blue-100", text: "text-blue-700" },
    CONFIRMED: { bg: "bg-green-100", text: "text-green-700" },
    PROCESSING: { bg: "bg-purple-100", text: "text-purple-700" },
    SHIPPED: { bg: "bg-amber-100", text: "text-amber-700" },
    DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700" },
  };

  const statusLabels: Record<string, string> = {
    NEW: "Nouvelle",
    CONFIRMED: "Confirmée",
    PROCESSING: "En préparation",
    SHIPPED: "Expédiée",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
  };

  async function handleStatusUpdate(orderId: string, newStatus: string) {
    const result = await updateOrderStatus({ id: orderId, tenantId, status: newStatus as any });
    if (!result.success) {
      // Could show toast here if needed
    }
  }

  async function handleCancel(orderId: string) {
    const result = await cancelOrder(tenantId, orderId);
    if (!result.success) {
      // Could show toast here
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Commandes</h1>
          <p className="text-sm text-muted-foreground">Suivez et gérez vos commandes</p>
        </div>
      </header>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Input
            placeholder="Rechercher commande, client..."
            defaultValue={searchParams.search || ""}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            defaultValue={statusFilter}
            onChange={(e) => window.location.href = `?page=1&search=${encodeURIComponent(searchParams.search || "")}&status=${e.target.value}`}
            className="rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="all">Tous les statuts</option>
            <option value="NEW">Nouvelles</option>
            <option value="CONFIRMED">Confirmées</option>
            <option value="PROCESSING">En préparation</option>
            <option value="SHIPPED">Expédiées</option>
            <option value="DELIVERED">Livrées</option>
            <option value="CANCELLED">Annulées</option>
          </select>
          <Button variant="outline" className="hidden sm:flex">
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
                const colors = statusColors[order.status];
                return (
                  <tr key={order.id} className="border-b last:border-b-0 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <Link href={`/dashboard/orders/${order.id}`} className="font-mono font-medium hover:underline">
                        #{order.id.slice(-8).toUpperCase()}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Badge variant="secondary">{order.itemCount} article{order.itemCount > 1 ? "s" : ""}</Badge>
                    </td>
                    <td className="px-4 py-3 font-medium">{formatNumber(order.total)} FCFA</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className={`${colors.bg} ${colors.text}`}>
                        {statusLabels[order.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link href={`/dashboard/orders/${order.id}`} className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg" title="Voir détails">
                          <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542 7-4.477 0-8.268-2.943-9.542 7z" /></svg>
                        </Link>
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                          className={`px-2 py-1 text-xs rounded border ${statusColors[order.status]?.bg} ${statusColors[order.status]?.text}`}
                        >
                          <option value="NEW">Nouvelle</option>
                          <option value="CONFIRMED">Confirmée</option>
                          <option value="PROCESSING">En préparation</option>
                          <option value="SHIPPED">Expédiée</option>
                          <option value="DELIVERED">Livrée</option>
                          <option value="CANCELLED">Annulée</option>
                        </select>
                        {["NEW", "CONFIRMED", "PROCESSING"].includes(order.status) && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => handleCancel(order.id)}>
                            <X className="size-3.5 mr-1" /> Annuler
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {totalPages} — {total} commande{total > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => window.location.href = `?page=${page - 1}&search=${encodeURIComponent(search)}&status=${statusFilter}`}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={page === totalPages} onClick={() => window.location.href = `?page=${page + 1}&search=${encodeURIComponent(search)}&status=${statusFilter}`}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

async function handleStatusUpdate(orderId: string, newStatus: string) {
  const result = await updateOrderStatus({ id: orderId, tenantId, status: newStatus as any });
  if (!result.success) {
    // Could show toast here if needed
  }
}

async function handleCancel(orderId: string) {
  const result = await cancelOrder(tenantId, orderId);
  if (!result.success) {
    // Could show toast here
  }
}

const statusColors: Record<string, { bg: string; text: string }> = {
  NEW: { bg: "bg-blue-100", text: "text-blue-700" },
  CONFIRMED: { bg: "bg-green-100", text: "text-green-700" },
  PROCESSING: { bg: "bg-purple-100", text: "text-purple-700" },
  SHIPPED: { bg: "bg-amber-100", text: "text-amber-700" },
  DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700" },
  CANCELLED: { bg: "bg-red-100", text: "text-red-700" },
};

const statusLabels: Record<string, string> = {
  NEW: "Nouvelle",
  CONFIRMED: "Confirmée",
  PROCESSING: "En préparation",
  SHIPPED: "Expédiée",
  DELIVERED: "Livrée",
  CANCELLED: "Annulée",
};