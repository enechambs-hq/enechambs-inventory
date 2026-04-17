"use client";

import { useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { Search, Mail, X, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { dashboardService } from "@/lib/services/dashboard.service";
import { Customer } from "@/types";
import { useAuthGuard } from "@/hooks/useAuthGuard";
import { UserRole } from "@/types";

const LIMIT = 20;

interface BroadcastResult {
  subject: string;
  totalRecipients: number;
  successful: number;
  failed: number;
}

function BroadcastModal({ onClose }: { onClose: () => void }) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) return;
    try {
      setSending(true);
      const res = await dashboardService.broadcastEmail(subject.trim(), message.trim(), senderName.trim() || undefined);
      setResult({
        subject: res.subject,
        totalRecipients: res.totalRecipients,
        successful: res.successful,
        failed: res.failed,
      });
      toast.success("Broadcast email sent");
    } catch (error) {
      const msg =
        (error as { response?: { data?: { message?: string | string[] } } })
          .response?.data?.message ?? "Failed to send broadcast";
      toast.error(Array.isArray(msg) ? msg[0] : msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 h-screen bg-black/50 flex items-center justify-center z-50">
      <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-lg shadow-sm animate-in zoom-in-95 fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail size={15} className="text-primary" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Broadcast Email</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        {result ? (
          /* Success state */
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-200">
              <CheckCircle size={18} className="text-green-600 shrink-0" />
              <p className="text-sm font-medium text-green-700">Email sent successfully</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4 space-y-3">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Summary</p>
              <p className="text-sm text-foreground">
                <span className="font-medium">Subject:</span> {result.subject}
              </p>
              <div className="grid grid-cols-3 gap-3 pt-1">
                {[
                  { label: "Total", value: result.totalRecipients },
                  { label: "Sent", value: result.successful, color: "text-green-600" },
                  { label: "Failed", value: result.failed, color: result.failed > 0 ? "text-red-600" : "text-muted-foreground" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-border p-3 text-center">
                    <p className="text-xs text-muted-foreground mb-1">{label}</p>
                    <p className={`text-xl font-bold ${color ?? "text-foreground"}`}>{value}</p>
                  </div>
                ))}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
            >
              Close
            </button>
          </div>
        ) : (
          /* Compose state */
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will send an email to all customers and staff who have an email address on record.
            </p>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                Sender Name <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <input
                type="text"
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder="e.g. LMart Team"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Special offer for our customers"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Message</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message here…"
                rows={5}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-accent transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sending || !subject.trim() || !message.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {sending ? (
                  <>
                    <div className="h-3.5 w-3.5 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Sending…
                  </>
                ) : (
                  <>
                    <Mail size={14} />
                    Send Broadcast
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CustomersPage() {
  useAuthGuard(UserRole.ADMIN);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [meta, setMeta] = useState({ total: 0, page: 1, limit: LIMIT, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const load = useCallback(async (page: number, q = search) => {
    try {
      setLoading(true);
      const res = await dashboardService.getCustomers(page, LIMIT, q);
      setCustomers(res.data);
      setMeta(res.meta);
    } catch {
      // fail silently
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    load(1);
  }, [load]);

  const filtered = customers;

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
        <div className="flex items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email or phone…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); load(1, e.target.value); }}
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <button
            onClick={() => setBroadcastOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors whitespace-nowrap"
          >
            <Mail size={14} />
            Broadcast Email
          </button>
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
              onClick={() => load(meta.page - 1, search)}
              disabled={meta.page <= 1}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => load(meta.page + 1, search)}
              disabled={meta.page >= meta.totalPages}
              className="px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {broadcastOpen && <BroadcastModal onClose={() => setBroadcastOpen(false)} />}
    </div>
  );
}
