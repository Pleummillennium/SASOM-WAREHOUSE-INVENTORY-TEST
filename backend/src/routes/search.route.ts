import { Router } from 'express';
import prisma from '../lib/prisma';

const router = Router();

// GET /api/search/order/:orderId
router.get('/order/:orderId', async (req, res, next) => {
  try {
    const { orderId } = req.params;

    const allocation = await prisma.slotAllocation.findUnique({
      where: { orderId },
      include: { order: true },
    });

    if (!allocation) {
      res.status(404).json({ success: false, message: `Order ${orderId} not found or not allocated` });
      return;
    }

    res.json({
      success: true,
      data: {
        orderId: allocation.orderId,
        productName: allocation.order.productName,
        category: allocation.order.category,
        boxHeight: allocation.order.boxHeight,
        price: allocation.order.price,
        location: {
          shelfCode: allocation.shelfCode,
          level: allocation.level,
          slot: allocation.slot,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/search/slot?shelf=C&level=1&slot=1
router.get('/slot', async (req, res, next) => {
  try {
    const { shelf, level, slot } = req.query;

    if (!shelf || !level || !slot) {
      res.status(400).json({ success: false, message: 'Query params required: shelf, level, slot' });
      return;
    }

    const levelNum = parseInt(level as string, 10);
    const slotNum = parseInt(slot as string, 10);

    if (isNaN(levelNum) || isNaN(slotNum)) {
      res.status(400).json({ success: false, message: 'level and slot must be numbers' });
      return;
    }

    const allocations = await prisma.slotAllocation.findMany({
      where: { shelfCode: shelf as string, level: levelNum, slot: slotNum },
      include: { order: true },
    });

    res.json({
      success: true,
      data: {
        location: { shelfCode: shelf, level: levelNum, slot: slotNum },
        count: allocations.length,
        orders: allocations.map((a) => ({
          orderId: a.orderId,
          productName: a.order.productName,
          category: a.order.category,
          boxHeight: a.order.boxHeight,
          price: a.order.price,
        })),
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
