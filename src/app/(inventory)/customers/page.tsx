"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Search } from "lucide-react";
import { dashboardService } from "@/lib/services/dashboard.service";
import { Customer } from "@/types";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { UserRole } from "@/types";

const LIMIT = 20;

export default function CustomersPage() {
  useAuthGuard(UserRole.ADMIN);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: LIMIT, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async (page: number) => {
    try {
      setLoading(true);
      const res = await dashboardService.getCustomers(page, LIMIT);
      setCustomers(res.data);
      setMeta(res.meta);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.customerName.toLowerCase().includes(q) ||
      (c.customerEmail ?? "").toLowerCase().includes(q) ||
      c.customerPhone.toLowerCase().includes(q)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header + Search */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {meta.total} customer{meta.total !== 1 ? "s" : ""} total
          </p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No customers found</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  {["Name", "Email", "Phone", "Purchases", "Total Spent", "Credits", "Last Purchase"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((c, i) => (
                  <tr key={i} className="border-t border-border hover:bg-accent transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">{c.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.customerEmail ?? <span className="text-muted-foreground/40">—</span>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.customerPhone}</td>
                    <td className="px-4 py-3 text-foreground">{c.totalPurchases}</td>
                    <td className="px-4 py-3 font-medium text-foreground">
                      ₦{c.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {c.creditPurchases.totalCredits > 0 ? (
                        <div className="space-y-0.5">
                          <p className="text-foreground font-medium">
                            {c.creditPurchases.totalCredits} credit{c.creditPurchases.totalCredits !== 1 ? "s" : ""}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            ₦{c.creditPurchases.totalPaid.toLocaleString()} / ₦{c.creditPurchases.totalCreditAmount.toLocaleString()} paid
                          </p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {format(new Date(c.lastPurchaseDate), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {meta.page} of {meta.totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => load(meta.page - 1)}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => load(meta.page + 1)}
              disabled={meta.page >= meta.totalPages}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
