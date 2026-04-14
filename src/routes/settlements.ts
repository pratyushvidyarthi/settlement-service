import { Router } from 'express';
import * as repo from '../db/settlements.repository';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/** GET /settlements/:bookingId */
router.get('/:bookingId', (req, res) => {
  const row = repo.findByBookingId(req.params.bookingId);
  if (!row) throw new AppError(404, 'Settlement not found');
  res.json(row);
});

export { router as settlementsRouter };
