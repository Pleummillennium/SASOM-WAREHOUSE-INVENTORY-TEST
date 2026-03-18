'use client';

import { use } from 'react';
import Link from 'next/link';
import { useShelfDetail } from '@/lib/queries';
import SlotGrid from '@/components/SlotGrid';
import { Badge } from '@/components/ui/badge';

const CATEGORY_COLOR: Record<string, string> = {
  shoes: 'bg-blue-100 text-blue-700',
  bags: 'bg-purple-100 text-purple-700',
  collectibles: 'bg-amber-100 text-amber-700',
  apparel: 'bg-green-100 text-green-700',
};

export default function ShelfDetailPage({ params }: { params: Promise<{ shelfCode: string }> }) {
  const { shelfCode } = use(params);
  const { data: shelf, isLoading, isError } = useShelfDetail(shelfCode);

  if (isLoading) {
    return <div className="p-8 text-zinc-500 text-sm">Loading shelf {shelfCode}...</div>;
  }

  if (isError || !shelf) {
    return <div className="p-8 text-red-500 text-sm">Shelf {shelfCode} not found.</div>;
  }

  return (
    <div className="p-8 space-y-6">
      {/* Breadcrumb */}
      <div className="text-sm text-zinc-400">
        <Link href="/" className="hover:text-zinc-700">
          Dashboard
        </Link>
        <span className="mx-2">/</span>
        <span className="text-zinc-700 font-medium">Shelf {shelf.shelfCode}</span>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-bold">Shelf {shelf.shelfCode}</h2>
        <Badge className={CATEGORY_COLOR[shelf.category] ?? ''}>
          {shelf.category}
        </Badge>
      </div>

      {/* Info bar */}
      <div className="flex gap-6 text-sm text-zinc-600 bg-white border border-zinc-200 rounded-xl px-6 py-4">
        <div>
          <span className="text-zinc-400">Levels</span>
          <p className="font-semibold">{shelf.totalLevels}</p>
        </div>
        <div>
          <span className="text-zinc-400">Slots / Level</span>
          <p className="font-semibold">{shelf.totalSlots}</p>
        </div>
        <div>
          <span className="text-zinc-400">Slot Height</span>
          <p className="font-semibold">{shelf.slotHeight} cm</p>
        </div>
        <div>
          <span className="text-zinc-400">Orders Allocated</span>
          <p className="font-semibold">{shelf.allocated}</p>
        </div>
      </div>

      {/* Slot grid */}
      <div className="bg-white border border-zinc-200 rounded-xl p-6">
        <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-4">
          Slot Map — hover to inspect
        </h3>
        <SlotGrid shelf={shelf} />
      </div>
    </div>
  );
}
