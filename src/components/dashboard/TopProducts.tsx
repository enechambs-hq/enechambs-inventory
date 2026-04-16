"use client";

import { useState } from "react";
import { TopProduct } from "@/types";

interface Props {
  products: TopProduct[];
}

const COLUMNS = ["#", "Product", "Sold", "Revenue", "Profit", "Margin"];
const PREVIEW_COUNT = 5;

function ProductRow({ p, i }: { p: TopProduct; i: number }) {
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="py-2.5 text-muted-foreground">{i + 1}</td>
      <td className="py-2.5 font-medium">{p.productName}</td>
      <td className="py-2.5">{p.totalSold}</td>
      <td className="py-2.5">₦{p.totalRevenue.toLocaleString()}</td>
      <td className="py-2.5">₦{p.totalProfit.toLocaleString()}</td>
      <td className="py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.min(p.profitMargin, 100).toFixed(1)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right">
            {p.profitMargin.toFixed(1)}%
          </span>
        </div>
      </td>
    </tr>
  );
}

function ProductTable({ products }: { products: TopProduct[] }) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr>
          {COLUMNS.map((h) => (
            <th key={h} className="pb-2 text-left text-xs font-medium text-muted-foreground">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y">
        {products.map((p, i) => (
          <ProductRow key={p.productName} p={p} i={i} />
        ))}
      </tbody>
    </table>
  );
}

export default function TopProducts({ products }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const preview = products.slice(0, PREVIEW_COUNT);
  const hasMore = products.length > PREVIEW_COUNT;

  return (
    <>
      <div className="rounded-xl border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Top Products</h2>
          {hasMore && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs text-primary hover:underline"
            >
              View all {products.length}
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground">No product data available</p>
        ) : (
          <ProductTable products={preview} />
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 h-screen bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl border p-6 w-full max-w-2xl max-h-[80vh] flex flex-col animate-in zoom-in-95 fade-in duration-300">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">All Top Products</h2>
              <button
                onClick={() => setModalOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto">
              <ProductTable products={products} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
