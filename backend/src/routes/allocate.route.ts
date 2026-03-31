import { Router } from 'express';
import { runAllocation, getLatestRunStatus } from '../services/allocation.service';
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

// GET /api/allocate/status
// ใช้ดูสถานะของ allocation run ล่าสุด
// สำคัญ: ถ้า server restart แล้วเจอ status = RUNNING หมายความว่า
// server crash กลางทาง ข้อมูลยังอยู่ครบ (transaction rollback แล้ว)
// แต่ frontend ควรแสดง warning ให้ user รู้ว่าต้องกด Run ใหม่
router.get('/status', async (_req, res, next) => {
  try {
    const latest = await getLatestRunStatus();

    // ถ้า server เพิ่ง restart มาแล้วเจอ RUNNING = crash กลางทาง
    // ตรวจจับด้วยการดูว่า startedAt นานเกิน 10 นาทีแล้วยังเป็น RUNNING อยู่
    // (ปกติ allocation ไม่ควรใช้เวลาเกิน 10 นาที)
    let isStale = false;
    if (latest?.status === 'RUNNING') {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      isStale = latest.startedAt < tenMinutesAgo;
    }

    res.json({ success: true, data: { run: latest, isStale } });
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
