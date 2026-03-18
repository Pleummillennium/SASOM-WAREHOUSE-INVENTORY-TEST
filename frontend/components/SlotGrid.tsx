import type { ShelfDetail, SlotItem } from '@/lib/types';
import { useState } from 'react';

function slotColor(items: SlotItem[], slotHeight: number): string {
  if (items.length === 0) return 'bg-zinc-100 border-zinc-200';
  const used = items.reduce((s, i) => s + i.boxHeight, 0);
  const pct = (used / slotHeight) * 100;
  if (pct >= 90) return 'bg-red-400 border-red-500';
  if (pct >= 50) return 'bg-amber-300 border-amber-400';
  return 'bg-emerald-300 border-emerald-400';
}

export default function SlotGrid({ shelf }: { shelf: ShelfDetail }) {
  const [hovered, setHovered] = useState<{ level: number; slot: number } | null>(null);

  const hoveredItems =
    hovered ? (shelf.grid[hovered.level]?.[hovered.slot] ?? []) : [];

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-zinc-100 border border-zinc-200 inline-block" />
          Empty
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-emerald-300 border border-emerald-400 inline-block" />
          &lt; 50%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-amber-300 border border-amber-400 inline-block" />
          50–89%
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded bg-red-400 border border-red-500 inline-block" />
          ≥ 90%
        </span>
      </div>

      {/* Grid: levels top to bottom (level 7 = top visually) */}
      <div className="space-y-1">
        {Array.from({ length: shelf.totalLevels }, (_, i) => shelf.totalLevels - i).map((level) => (
          <div key={level} className="flex items-center gap-1">
            <span className="text-xs text-zinc-400 w-6 text-right shrink-0">L{level}</span>
            <div className="flex gap-0.5 flex-wrap">
              {Array.from({ length: shelf.totalSlots }, (_, i) => i + 1).map((slot) => {
                const items = shelf.grid[level]?.[slot] ?? [];
                return (
                  <div
                    key={slot}
                    className={`w-4 h-4 rounded-sm border cursor-pointer transition-transform hover:scale-125 ${slotColor(items, shelf.slotHeight)}`}
                    onMouseEnter={() => setHovered({ level, slot })}
                    onMouseLeave={() => setHovered(null)}
                    title={`Level ${level} Slot ${slot} — ${items.length} item(s)`}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Slot detail on hover */}
      {hovered && (
        <div className="mt-4 border border-zinc-200 rounded-lg p-4 bg-white text-sm">
          <p className="font-semibold text-zinc-700 mb-2">
            Level {hovered.level} · Slot {hovered.slot}
            <span className="ml-2 text-zinc-400 font-normal">
              ({hoveredItems.length} item{hoveredItems.length !== 1 ? 's' : ''})
            </span>
          </p>
          {hoveredItems.length === 0 ? (
            <p className="text-zinc-400">Empty slot</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-zinc-400 border-b">
                  <th className="text-left pb-1">Order ID</th>
                  <th className="text-left pb-1">Product</th>
                  <th className="text-right pb-1">Height</th>
                  <th className="text-right pb-1">Price</th>
                </tr>
              </thead>
              <tbody>
                {hoveredItems.map((item) => (
                  <tr key={item.orderId} className="border-b border-zinc-100">
                    <td className="py-1 font-mono">{item.orderId}</td>
                    <td className="py-1 text-zinc-600">{item.productName}</td>
                    <td className="py-1 text-right">{item.boxHeight} cm</td>
                    <td className="py-1 text-right">฿{item.price.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
