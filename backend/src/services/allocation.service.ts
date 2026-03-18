import prisma from '../lib/prisma';
import type { Shelf } from '@prisma/client';

type SlotKey = string; // `${shelfCode}|${level}|${slot}`

function slotKey(shelfCode: string, level: number, slot: number): SlotKey {
  return `${shelfCode}|${level}|${slot}`;
}

function getEligibleShelves(shelves: Shelf[], category: string, boxHeight: number): Shelf[] {
  return shelves.filter((shelf) => {
    if (shelf.category !== category) return false;
    if (shelf.minBoxHeight !== null && boxHeight < shelf.minBoxHeight) return false;
    if (shelf.maxBoxHeight !== null && boxHeight > shelf.maxBoxHeight) return false;
    return true;
  });
}

export interface AllocationResult {
  allocated: number;
  skipped: number;
  skippedOrders: string[];
}

export async function runAllocation(): Promise<AllocationResult> {
  // Clear existing allocations
  await prisma.slotAllocation.deleteMany();

  // Load all shelves sorted alphabetically
  const shelves = await prisma.shelf.findMany({ orderBy: { shelfCode: 'asc' } });

  // Load all orders sorted by orderId ASC
  const orders = await prisma.order.findMany({ orderBy: { orderId: 'asc' } });

  // In-memory tracker: slotKey → accumulated height (cm)
  const usedHeight = new Map<SlotKey, number>();

  const getUsed = (shelfCode: string, level: number, slot: number): number =>
    usedHeight.get(slotKey(shelfCode, level, slot)) ?? 0;

  const addUsed = (shelfCode: string, level: number, slot: number, height: number): void => {
    const key = slotKey(shelfCode, level, slot);
    usedHeight.set(key, (usedHeight.get(key) ?? 0) + height);
  };

  const allocations: { orderId: string; shelfCode: string; level: number; slot: number }[] = [];
  const skippedOrders: string[] = [];

  for (const order of orders) {
    const eligible = getEligibleShelves(shelves, order.category, order.boxHeight);
    let assigned = false;

    // Priority: Level 1→7, then Shelf (alphabetical), then Slot 1→50
    outer: for (let level = 1; level <= 7; level++) {
      for (const shelf of eligible) {
        for (let slot = 1; slot <= shelf.totalSlots; slot++) {
          if (getUsed(shelf.shelfCode, level, slot) + order.boxHeight <= shelf.slotHeight) {
            addUsed(shelf.shelfCode, level, slot, order.boxHeight);
            allocations.push({ orderId: order.orderId, shelfCode: shelf.shelfCode, level, slot });
            assigned = true;
            break outer;
          }
        }
      }
    }

    if (!assigned) {
      skippedOrders.push(order.orderId);
    }
  }

  // Bulk insert in batches
  const BATCH = 500;
  for (let i = 0; i < allocations.length; i += BATCH) {
    await prisma.slotAllocation.createMany({ data: allocations.slice(i, i + BATCH) });
  }

  return { allocated: allocations.length, skipped: skippedOrders.length, skippedOrders };
}
