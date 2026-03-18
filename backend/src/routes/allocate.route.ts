import { Router } from 'express';
import { runAllocation } from '../services/allocation.service';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/allocate/stats
router.get('/stats', async (_req, res, next) => {
  try {
    const [totalOrders, totalAllocated] = await Promise.all([
      prisma.order.count(),
      prisma.slotAllocation.count(),
    ]);

    // Orders with no allocation (skipped)
    const skippedOrders = await prisma.order.findMany({
      where: { allocation: null },
      select: { orderId: true, category: true, boxHeight: true, productName: true },
      orderBy: { orderId: 'asc' },
      take: 100,
    });

    // Per-category breakdown
    const ordersByCategory = await prisma.order.groupBy({
      by: ['category'],
      _count: { id: true },
    });

    const allocatedByCategory = await prisma.order.findMany({
      where: { allocation: { isNot: null } },
      select: { category: true },
    });

    const allocatedCount: Record<string, number> = {};
    for (const o of allocatedByCategory) {
      allocatedCount[o.category] = (allocatedCount[o.category] ?? 0) + 1;
    }

    const byCategory = ordersByCategory.map((row) => ({
      category: row.category,
      total: row._count.id,
      allocated: allocatedCount[row.category] ?? 0,
      skipped: row._count.id - (allocatedCount[row.category] ?? 0),
    }));

    res.json({
      success: true,
      data: {
        totalOrders,
        allocated: totalAllocated,
        skipped: totalOrders - totalAllocated,
        byCategory,
        skippedOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/allocate/run
router.post('/run', async (_req, res, next) => {
  try {
    const result = await runAllocation();
    res.json({
      success: true,
      data: {
        allocated: result.allocated,
        skipped: result.skipped,
        skippedOrders: result.skippedOrders,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
