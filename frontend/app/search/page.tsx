'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import api from '@/lib/api';
import type { OrderLocation, SlotSearch } from '@/lib/types';

export default function SearchPage() {
  return (
    <div className="p-8 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Search</h2>
        <p className="text-zinc-500 text-sm mt-1">Find orders or inspect slot contents</p>
      </div>

      <Tabs defaultValue="order" className="max-w-2xl">
        <TabsList>
          <TabsTrigger value="order">By Order ID</TabsTrigger>
          <TabsTrigger value="slot">By Slot</TabsTrigger>
        </TabsList>

        <TabsContent value="order" className="mt-4">
          <SearchByOrder />
        </TabsContent>

        <TabsContent value="slot" className="mt-4">
          <SearchBySlot />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SearchByOrder() {
  const [input, setInput] = useState('');
  const [result, setResult] = useState<OrderLocation | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get<{ success: boolean; data: OrderLocation }>(
        `/api/search/order/${input.trim().toUpperCase()}`,
      );
      setResult(res.data.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Not found';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="e.g. ORD00001"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
          className="font-mono"
        />
        <Button onClick={search} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <span className="font-mono font-semibold text-zinc-700">{result.orderId}</span>
            <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full capitalize">
              {result.category}
            </span>
          </div>

          <div>
            <p className="text-sm text-zinc-500">Product</p>
            <p className="font-medium">{result.productName}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500">Box Height</p>
              <p className="font-medium">{result.boxHeight} cm</p>
            </div>
            <div>
              <p className="text-zinc-500">Price</p>
              <p className="font-medium">฿{result.price.toLocaleString()}</p>
            </div>
          </div>

          <div className="rounded-lg bg-zinc-50 border border-zinc-200 p-4">
            <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Location</p>
            <div className="flex gap-6 text-sm">
              <div>
                <p className="text-zinc-500">Shelf</p>
                <p className="font-bold text-lg">{result.location.shelfCode}</p>
              </div>
              <div>
                <p className="text-zinc-500">Level</p>
                <p className="font-bold text-lg">{result.location.level}</p>
              </div>
              <div>
                <p className="text-zinc-500">Slot</p>
                <p className="font-bold text-lg">{result.location.slot}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchBySlot() {
  const [shelf, setShelf] = useState('');
  const [level, setLevel] = useState('');
  const [slot, setSlot] = useState('');
  const [result, setResult] = useState<SlotSearch | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const search = async () => {
    if (!shelf.trim() || !level || !slot) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const res = await api.get<{ success: boolean; data: SlotSearch }>('/api/search/slot', {
        params: { shelf: shelf.trim().toUpperCase(), level: parseInt(level), slot: parseInt(slot) },
      });
      setResult(res.data.data);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Error fetching slot';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input
          placeholder="Shelf (e.g. C)"
          value={shelf}
          onChange={(e) => setShelf(e.target.value)}
          className="font-mono w-28"
        />
        <Input
          placeholder="Level"
          type="number"
          min={1}
          max={7}
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="w-24"
        />
        <Input
          placeholder="Slot"
          type="number"
          min={1}
          max={50}
          value={slot}
          onChange={(e) => setSlot(e.target.value)}
          className="w-24"
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <Button onClick={search} disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-zinc-700">
              Shelf {result.location.shelfCode} · Level {result.location.level} · Slot{' '}
              {result.location.slot}
            </p>
            <span className="text-xs bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded-full">
              {result.count} item{result.count !== 1 ? 's' : ''}
            </span>
          </div>

          {result.count === 0 ? (
            <p className="text-zinc-400 text-sm">This slot is empty.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-zinc-400 text-xs border-b">
                  <th className="text-left pb-2">Order ID</th>
                  <th className="text-left pb-2">Product</th>
                  <th className="text-right pb-2">Height</th>
                  <th className="text-right pb-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {result.orders.map((o) => (
                  <tr key={o.orderId} className="border-b border-zinc-100">
                    <td className="py-2 font-mono text-xs">{o.orderId}</td>
                    <td className="py-2 text-zinc-600">{o.productName}</td>
                    <td className="py-2 text-right">{o.boxHeight} cm</td>
                    <td className="py-2 text-right">฿{o.price.toLocaleString()}</td>
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
