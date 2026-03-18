'use client';

import { useShelves } from '@/lib/queries';
import ShelfCard from '@/components/ShelfCard';
import type { ShelfSummary } from '@/lib/types';

const CATEGORIES = ['shoes', 'bags', 'collectibles', 'apparel'];

export default function DashboardPage() {
  const { data: shelves, isLoading, isError } = useShelves();

  if (isLoading) {
    return <div className="p-8 text-zinc-500 text-sm">Loading shelves...</div>;
  }

  if (isError || !shelves) {
    return (
      <div className="p-8 text-red-500 text-sm">
        Failed to load shelves. Is the backend running?
      </div>
    );
  }

  const grouped = CATEGORIES.reduce<Record<string, ShelfSummary[]>>((acc, cat) => {
    acc[cat] = shelves.filter((s) => s.category === cat);
    return acc;
  }, {});

  const totalAllocated = shelves.reduce((s, sh) => s + sh.ordersAllocated, 0);
  const totalSlots = shelves.reduce((s, sh) => s + sh.totalSlotCapacity, 0);
  const totalUsed = shelves.reduce((s, sh) => s + sh.slotsUsed, 0);

  return (
    <div className="p-8 space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Warehouse Dashboard</h2>
        <p className="text-zinc-500 text-sm mt-1">Real-time shelf allocation overview</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Shelves" value={shelves.length} />
        <StatCard label="Orders Allocated" value={totalAllocated.toLocaleString()} />
        <StatCard
          label="Slots Used"
          value={`${totalUsed.toLocaleString()} / ${totalSlots.toLocaleString()}`}
        />
      </div>

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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 px-5 py-4">
      <p className="text-xs text-zinc-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
