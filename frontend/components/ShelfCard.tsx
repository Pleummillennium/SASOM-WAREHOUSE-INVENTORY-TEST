import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { ShelfSummary } from '@/lib/types';

const CATEGORY_COLOR: Record<string, string> = {
  shoes: 'bg-blue-100 text-blue-700',
  bags: 'bg-purple-100 text-purple-700',
  collectibles: 'bg-amber-100 text-amber-700',
  apparel: 'bg-green-100 text-green-700',
};

const USAGE_BAR_COLOR = (pct: number) => {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 60) return 'bg-amber-400';
  return 'bg-emerald-500';
};

export default function ShelfCard({ shelf }: { shelf: ShelfSummary }) {
  const heightLabel =
    shelf.minBoxHeight !== null
      ? `≥ ${shelf.minBoxHeight} cm`
      : shelf.maxBoxHeight !== null
        ? `< ${shelf.maxBoxHeight + 1} cm`
        : 'Any height';

  return (
    <Link href={`/shelves/${shelf.shelfCode}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-bold">{shelf.shelfCode}</CardTitle>
            <Badge className={CATEGORY_COLOR[shelf.category] ?? 'bg-zinc-100 text-zinc-700'}>
              {shelf.category}
            </Badge>
          </div>
          <p className="text-xs text-zinc-500">{heightLabel}</p>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Usage bar */}
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Slots used</span>
              <span>{shelf.slotsUsed} / {shelf.totalSlotCapacity}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${USAGE_BAR_COLOR(shelf.usagePercent)}`}
                style={{ width: `${Math.min(shelf.usagePercent, 100)}%` }}
              />
            </div>
            <p className="text-right text-xs text-zinc-400 mt-0.5">{shelf.usagePercent}%</p>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Orders</span>
            <span className="font-medium">{shelf.ordersAllocated}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-zinc-500">Slot height</span>
            <span className="font-medium">{shelf.slotHeight} cm</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
