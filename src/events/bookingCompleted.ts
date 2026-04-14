import { z } from 'zod';

export const BookingCompletedEventSchema = z.object({
  event:         z.literal('BookingCompleted'),
  bookingId:     z.string(),
  userId:        z.string(),
  preAuthId:          z.string(),
  preAuthAmountCents: z.number().int().positive(),
  baseFareCents:      z.number().int().positive(),
  actualUnits:   z.number().int().nonnegative(),
  includedUnits: z.number().int().nonnegative(),
  scheduledEnd:  z.string().datetime(),
  actualEnd:     z.string().datetime(),
});

export type BookingCompletedEvent = z.infer<typeof BookingCompletedEventSchema>;
