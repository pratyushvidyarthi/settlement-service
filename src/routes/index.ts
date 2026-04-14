import { Router } from 'express';
import { bookingsRouter } from './bookings';
import { settlementsRouter } from './settlements';

const router = Router();

router.use('/events', bookingsRouter);
router.use('/settlements', settlementsRouter);

export { router as apiRouter };
