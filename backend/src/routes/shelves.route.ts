import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/shelves
router.get('/', async (_req, res, next) => {
  try {
    const shelves = await prisma.shelf.findMany({
      orderBy: { shelfCode: 'asc' },
    });

    // Count distinct slots used and total orders per shelf
    const slotUsage = await prisma.slotAllocation.groupBy({
      by: ['shelfCode', 'level', 'slot'],
      _count: { id: true },
    });
    const orderCounts = await prisma.slotAllocation.groupBy({
      by: ['shelfCode'],
      _count: { id: true },
    });

    // slotsUsed: number of distinct (level, slot) pairs that have at least 1 order
    const slotsUsedMap = new Map<string, number>();
    for (const row of slotUsage) {
      slotsUsedMap.set(row.shelfCode, (slotsUsedMap.get(row.shelfCode) ?? 0) + 1);
    }
    const orderCountMap = new Map(orderCounts.map((u) => [u.shelfCode, u._count.id]));

    const data = shelves.map((shelf) => {
      const slotsUsed = slotsUsedMap.get(shelf.shelfCode) ?? 0;
      const totalSlotCapacity = shelf.totalLevels * shelf.totalSlots;
      return {
        shelfCode: shelf.shelfCode,
        category: shelf.category,
        minBoxHeight: shelf.minBoxHeight,
        maxBoxHeight: shelf.maxBoxHeight,
        slotHeight: shelf.slotHeight,
        totalLevels: shelf.totalLevels,
        totalSlots: shelf.totalSlots,
        ordersAllocated: orderCountMap.get(shelf.shelfCode) ?? 0,
        slotsUsed,
        totalSlotCapacity,
        usagePercent: totalSlotCapacity > 0 ? Math.round((slotsUsed / totalSlotCapacity) * 100) : 0,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

// GET /api/shelves/:shelfCode
router.get('/:shelfCode', async (req, res, next) => {
  try {
    const { shelfCode } = req.params;

    const shelf = await prisma.shelf.findUnique({ where: { shelfCode } });
    if (!shelf) {
      res.status(404).json({ success: false, message: `Shelf ${shelfCode} not found` });
      return;
    }

    const allocations = await prisma.slotAllocation.findMany({
      where: { shelfCode },
      include: { order: true },
      orderBy: [{ level: 'asc' }, { slot: 'asc' }],
    });

    // Build slot grid: level → slot → orders[]
    type SlotItem = { orderId: string; productName: string; boxHeight: number; price: number };
    const grid: Record<number, Record<number, SlotItem[]>> = {};

    for (let l = 1; l <= shelf.totalLevels; l++) {
      grid[l] = {};
      for (let s = 1; s <= shelf.totalSlots; s++) {
        grid[l][s] = [];
      }
    }

    for (const a of allocations) {
      grid[a.level][a.slot].push({
        orderId: a.orderId,
        productName: a.order.productName,
        boxHeight: a.order.boxHeight,
        price: a.order.price,
      });
    }

    res.json({
      success: true,
      data: {
        shelfCode: shelf.shelfCode,
        category: shelf.category,
        slotHeight: shelf.slotHeight,
        totalLevels: shelf.totalLevels,
        totalSlots: shelf.totalSlots,
        allocated: allocations.length,
        grid,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
