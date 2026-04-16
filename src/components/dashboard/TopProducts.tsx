'use client';

import { useState } from 'react';
import { TopProduct } from '@/types';

interface Props {
  products: TopProduct[];
}

const COLUMNS = ['#', 'Product', 'Sold', 'Revenue', 'Profit', 'Margin'];
const PREVIEW_COUNT = 5;

function ProductRow({ p, i }: { p: TopProduct; i: number }) {
  return (
    <tr className="hover:bg-accent transition-colors group">
      <td className="py-3 pr-3 text-xs font-medium text-muted-foreground w-6">
        {i + 1}
      </td>
      <td className="py-3 text-sm font-medium text-foreground">{p.productName}</td>
      <td className="py-3 text-sm text-muted-foreground">{p.totalSold}</td>
      <td className="py-3 text-sm text-foreground">₦{p.totalRevenue.toLocaleString()}</td>
      <td className="py-3 text-sm text-foreground">₦{p.totalProfit.toLocaleString()}</td>
      <td className="py-3 text-sm w-40">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${Math.min(p.profitMargin, 100).toFixed(1)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground w-10 text-right shrink-0">
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
        <tr className="border-b border-border">
          {COLUMNS.map((h) => (
            <th
              key={h}
              className="pb-3 text-left text-xs font-semibold text-muted-foreground tracking-wide"
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
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
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-foreground">Top Products</h2>
          {hasMore && (
            <button
              onClick={() => setModalOpen(true)}
              className="text-xs text-primary font-medium hover:underline"
            >
              View all {products.length}
            </button>
          )}
        </div>

        {products.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No product data available
          </p>
        ) : (
          <ProductTable products={preview} />
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-2xl border border-border p-6 w-full max-w-3xl max-h-[80vh] flex flex-col shadow-xl animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-semibold text-foreground">
                All Top Products
              </h2>
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
