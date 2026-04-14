import { Router } from 'express';
import { BookingCompletedEventSchema } from '../events/bookingCompleted';
import { processBookingCompleted } from '../services/settlementService';

const router = Router();

/**
 * POST /events/booking-completed
 * Receives a booking completion event and triggers settlement.
 */
router.post('/booking-completed', async (req, res) => {
  const event = BookingCompletedEventSchema.parse(req.body);
  await processBookingCompleted(event);
  res.status(202).json({ accepted: true });
});

export { router as bookingsRouter };
