const OVERAGE_RATE_CENTS      = 25;    // $0.25 per extra unit
const LATE_FEE_CENTS_PER_HOUR = 1_500; // $15.00 per hour, partial hours round up

export interface ChargeInput {
  baseFareCents:  number; // pre-calculated by the booking system
  actualUnits:    number; // units the customer actually consumed
  includedUnits:  number; // units covered by their plan
  scheduledEndAt: Date;
  actualEndAt:    Date;
}

export interface ChargeBreakdown {
  baseFareCents:     number;
  usageOverageCents: number;
  lateFeeCents:      number;
  amountCents:       number; // baseFareCents + usageOverageCents + lateFeeCents
}

export function calculateCharge(input: ChargeInput): ChargeBreakdown {
  const { baseFareCents, actualUnits, includedUnits, scheduledEndAt, actualEndAt } = input;

  const extraUnits       = Math.max(0, actualUnits - includedUnits);
  const usageOverageCents = extraUnits * OVERAGE_RATE_CENTS;

  const lateMs       = Math.max(0, actualEndAt.getTime() - scheduledEndAt.getTime());
  const lateHours    = Math.ceil(lateMs / (60 * 60 * 1_000));
  const lateFeeCents = lateHours * LATE_FEE_CENTS_PER_HOUR;

  const amountCents = baseFareCents + usageOverageCents + lateFeeCents;

  return { baseFareCents, usageOverageCents, lateFeeCents, amountCents };
}
