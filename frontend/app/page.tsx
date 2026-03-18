'use client';

import { useState } from 'react';
import { useAllocationStats, useShelves } from '@/lib/queries';
import ShelfCard from '@/components/ShelfCard';
import RunAllocationButton from '@/components/RunAllocationButton';
import { Badge } from '@/components/ui/badge';
import type { ShelfSummary } from '@/lib/types';

const CATEGORIES = ['shoes', 'bags', 'collectibles', 'apparel'];

const CATEGORY_COLOR: Record<string, string> = {
  shoes: 'bg-blue-100 text-blue-700',
  bags: 'bg-purple-100 text-purple-700',
  collectibles: 'bg-amber-100 text-amber-700',
  apparel: 'bg-green-100 text-green-700',
};

export default function DashboardPage() {
  const { data: shelves, isLoading: shelvesLoading, isError: shelvesError } = useShelves();
  const { data: stats, isLoading: statsLoading } = useAllocationStats();
  const [showSkipped, setShowSkipped] = useState(false);

  if (shelvesLoading || statsLoading) {
    return <div className="p-8 text-zinc-500 text-sm">Loading...</div>;
  }

  if (shelvesError || !shelves) {
    return (
      <div className="p-8 text-red-500 text-sm">
        Failed to load. Is the backend running?
      </div>
    );
  }

  const grouped = CATEGORIES.reduce<Record<string, ShelfSummary[]>>((acc, cat) => {
    acc[cat] = shelves.filter((s) => s.category === cat);
    return acc;
  }, {});

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Warehouse Dashboard</h2>
          <p className="text-zinc-500 text-sm mt-1">Real-time shelf allocation overview</p>
        </div>
        <RunAllocationButton />
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Total Shelves" value={shelves.length} />
        <StatCard
          label="Orders Allocated"
          value={stats?.allocated.toLocaleString() ?? '—'}
          sub={`of ${stats?.totalOrders.toLocaleString()}`}
          color="text-emerald-600"
        />
        <StatCard
          label="Skipped Orders"
          value={stats?.skipped.toLocaleString() ?? '—'}
          sub="warehouse full"
          color="text-red-500"
          onClick={() => setShowSkipped((v) => !v)}
          clickable
        />
        <StatCard
          label="Allocation Rate"
          value={
            stats
              ? `${Math.round((stats.allocated / stats.totalOrders) * 100)}%`
              : '—'
          }
          color="text-blue-600"
        />
      </div>

      {/* Per-category breakdown */}
      {stats && (
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
            Allocation by Category
          </h3>
          <div className="space-y-3">
            {stats.byCategory.map((row) => {
              const pct = Math.round((row.allocated / row.total) * 100);
              return (
                <div key={row.category} className="flex items-center gap-4">
                  <Badge className={`${CATEGORY_COLOR[row.category]} w-24 justify-center capitalize`}>
                    {row.category}
                  </Badge>
                  <div className="flex-1 h-2 rounded-full bg-zinc-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-sm text-zinc-600 w-28 text-right">
                    {row.allocated.toLocaleString()} / {row.total.toLocaleString()}
                  </span>
                  <span className="text-sm text-red-400 w-20 text-right">
                    -{row.skipped.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Skipped orders panel */}
      {showSkipped && stats && stats.skippedOrders.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-red-600 uppercase tracking-wider">
              Skipped Orders — No shelf capacity available (showing first {stats.skippedOrders.length})
            </h3>
            <button
              onClick={() => setShowSkipped(false)}
              className="text-xs text-red-400 hover:text-red-600"
            >
              Close
            </button>
          </div>
          <div className="overflow-auto max-h-64">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-red-400 border-b border-red-200">
                  <th className="text-left pb-2">Order ID</th>
                  <th className="text-left pb-2">Product</th>
                  <th className="text-left pb-2">Category</th>
                  <th className="text-right pb-2">Box Height</th>
                </tr>
              </thead>
              <tbody>
                {stats.skippedOrders.map((o) => (
                  <tr key={o.orderId} className="border-b border-red-100">
                    <td className="py-1.5 font-mono text-red-700">{o.orderId}</td>
                    <td className="py-1.5 text-zinc-600">{o.productName}</td>
                    <td className="py-1.5">
                      <Badge className={`${CATEGORY_COLOR[o.category]} text-xs`}>
                        {o.category}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-right text-zinc-500">{o.boxHeight} cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shelves by category */}
      {CATEGORIES.map((cat) => {
        const group = grouped[cat];
        if (!group?.length) return null;
        return (
          <section key={cat}>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 mb-3 capitalize">
              {cat} — {group.length} shelves
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {group.map((shelf) => (
                <ShelfCard key={shelf.shelfCode} shelf={shelf} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
  onClick,
  clickable,
}: {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
  onClick?: () => void;
  clickable?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-zinc-200 px-5 py-4 ${clickable ? 'cursor-pointer hover:border-zinc-300 transition-colors' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${color ?? ''}`}>{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
      {clickable && <p className="text-xs text-zinc-400 mt-1 underline">click to view</p>}
    </div>
  );
}
