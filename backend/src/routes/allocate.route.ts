import { Router } from 'express';
import { runAllocation, getLatestRunStatus } from '../services/allocation.service';
import prisma from '../lib/prisma';

const router = Router();

// --- CSV helper ---
// quote ค่าที่มี comma, double-quote, หรือ newline ตาม RFC 4180
// สำคัญ: productName บางตัวมี comma เช่น "Nike Air, Max" ถ้าไม่ quote จะทำให้ CSV column เลื่อน
function toCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function toCsvRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(toCsvField).join(',') + '\n';
}

// GET /api/allocate/export
// Stream CSV file — ไม่โหลดทั้งหมดขึ้น memory ก่อน res.json()
// เพราะ allocated + skipped อาจมีหลายหมื่น rows
// การ write ทีละ row ทำให้ memory คงที่ไม่ว่าจะมีกี่ row
router.get('/export', async (_req, res, next) => {
  try {
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    // attachment บอก browser ให้ download แทนที่จะแสดงใน tab
    // ใส่ timestamp ใน filename เพื่อไม่ให้ไฟล์ทับกันถ้า export หลายครั้ง
    res.setHeader('Content-Disposition', `attachment; filename="allocation-${timestamp}.csv"`);

    // Header row
    res.write(
      toCsvRow(['orderId', 'productName', 'category', 'boxHeight', 'price', 'status', 'shelfCode', 'level', 'slot', 'allocatedAt']),
    );

    // Allocated orders — include order details เพราะ SlotAllocation เก็บแค่ FK
    const allocated = await prisma.slotAllocation.findMany({
      include: { order: true },
      orderBy: { orderId: 'asc' },
    });

    for (const a of allocated) {
      res.write(
        toCsvRow([a.orderId, a.order.productName, a.order.category, a.order.boxHeight, a.order.price, 'ALLOCATED', a.shelfCode, a.level, a.slot, a.allocatedAt.toISOString()]),
      );
    }

    // Skipped orders — orders ที่ไม่มี allocation record (warehouse เต็ม)
    // location columns ว่างเปล่าเพราะไม่ได้ถูก assign
    const skipped = await prisma.order.findMany({
      where: { allocation: null },
      orderBy: { orderId: 'asc' },
    });

    for (const o of skipped) {
      res.write(toCsvRow([o.orderId, o.productName, o.category, o.boxHeight, o.price, 'SKIPPED', '', '', '', '']));
    }

    res.end();
  } catch (err) {
    next(err);
  }
});

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
