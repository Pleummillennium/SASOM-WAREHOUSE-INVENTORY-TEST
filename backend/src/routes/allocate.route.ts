import { Router } from 'express';
import { runAllocation } from '../services/allocation.service';

const router = Router();

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
