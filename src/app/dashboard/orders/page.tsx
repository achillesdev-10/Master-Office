"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Filter, ChevronLeft, ChevronRight, Eye, Truck, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatNumber } from "@/lib/utils";

interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  total: number;
  status: "NEW" | "CONFIRMED" | "PROCESSING" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  createdAt: string;
  itemCount: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const mockOrders: Order[] = [
    {
      id: "ord_1",
      customerName: "Jean Kouassi",
      customerPhone: "07 01 02 03 04",
      total: 125000,
      status: "NEW",
      createdAt: "2024-01-15T10:30:00Z",
      itemCount: 2,
    },
    {
      id: "ord_2",
      customerName: "Marie Dupont",
      customerPhone: "05 06 07 08 09",
      total: 89000,
      status: "CONFIRMED",
      createdAt: "2024-01-14T14:20:00Z",
      itemCount: 1,
    },
    {
      id: "ord_3",
      customerName: "Pierre Martin",
      customerPhone: "01 02 03 04 05",
      total: 210000,
      status: "PROCESSING",
      createdAt: "2024-01-13T09:15:00Z",
      itemCount: 3,
    },
  ];

  setTimeout(() => {
    setOrders(mockOrders);
    setLoading(false);
  }, 500);

  const filteredOrders = orders.filter((o) => {
    const matchesSearch = o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.customerName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);

  const statusColors: Record<Order["status"], { bg: string; text: string }> = {
    NEW: { bg: "bg-blue-100", text: "text-blue-700" },
    CONFIRMED: { bg: "bg-green-100", text: "text-green-700" },
    PROCESSING: { bg: "bg-purple-100", text: "text-purple-700" },
    SHIPPED: { bg: "bg-amber-100", text: "text-amber-700" },
    DELIVERED: { bg: "bg-emerald-100", text: "text-emerald-700" },
    CANCELLED: { bg: "bg-red-100", text: "text-red-700" },
  };

  const statusLabels: Record<Order["status"], string> = {
    NEW: "Nouvelle",
    CONFIRMED: "Confirmée",
    PROCESSING: "En préparation",
    SHIPPED: "Expédiée",
    DELIVERED: "Livrée",
    CANCELLED: "Annulée",
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
      </div>
    );
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
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
              {filteredOrders.map((order) => {
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
                        {order.status === "NEW" && (
                          <Button variant="outline" size="sm" onClick={() => { /* Confirmer */ }}>
                            Confirmer
                          </Button>
                        )}
                        {order.status === "CONFIRMED" && (
                          <Button variant="outline" size="sm" onClick={() => { /* Marquer expédiée */ }}>
                            <Truck className="size-3.5 mr-1" /> Expédier
                          </Button>
                        )}
                        {["NEW", "CONFIRMED", "PROCESSING"].includes(order.status) && (
                          <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => { /* Annuler */ }}>
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
        {filteredOrders.length > pageSize && (
          <div className="flex items-center justify-between border-t px-4 py-3">
            <p className="text-sm text-muted-foreground">
              Page {page} sur {Math.ceil(filteredOrders.length / pageSize)} — {filteredOrders.length} commande{filteredOrders.length > 1 ? "s" : ""}
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(Math.ceil(filteredOrders.length / pageSize), p + 1))} disabled={page === Math.ceil(filteredOrders.length / pageSize)}>
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}