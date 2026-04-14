import { describe, it, expect } from 'vitest';
import { calculateCharge } from './chargeCalculator';

// Convenience: build a Date from an HH:MM string on a fixed day
const at = (hhmm: string) => new Date(`2024-01-01T${hhmm}:00Z`);

describe('calculateCharge', () => {
  describe('no extras', () => {
    it('returns base fare only when units match and returned on time', () => {
      expect(
        calculateCharge({
          baseFareCents: 5_000,
          actualUnits:   100,
          includedUnits: 100,
          scheduledEndAt: at('18:00'),
          actualEndAt:    at('18:00'),
        }),
      ).toEqual({
        baseFareCents:     5_000,
        usageOverageCents: 0,
        lateFeeCents:      0,
        amountCents:       5_000,
      });
    });

    it('under-plan usage does not create a credit', () => {
      const result = calculateCharge({
        baseFareCents: 5_000,
        actualUnits:   80,
        includedUnits: 100,
        scheduledEndAt: at('18:00'),
        actualEndAt:    at('18:00'),
      });
      expect(result.usageOverageCents).toBe(0);
      expect(result.amountCents).toBe(5_000);
    });

    it('early return does not create a credit', () => {
      const result = calculateCharge({
        baseFareCents: 5_000,
        actualUnits:   100,
        includedUnits: 100,
        scheduledEndAt: at('18:00'),
        actualEndAt:    at('17:00'),
      });
      expect(result.lateFeeCents).toBe(0);
      expect(result.amountCents).toBe(5_000);
    });
  });

  describe('usage overage only', () => {
    it('charges $0.25 per extra unit', () => {
      expect(
        calculateCharge({
          baseFareCents: 5_000,
          actualUnits:   120,
          includedUnits: 100,
          scheduledEndAt: at('18:00'),
          actualEndAt:    at('18:00'),
        }),
      ).toEqual({
        baseFareCents:     5_000,
        usageOverageCents: 500,   // 20 × 25
        lateFeeCents:      0,
        amountCents:       5_500,
      });
    });
  });

  describe('late return only', () => {
    it('charges $15 per full hour for an exact number of hours', () => {
      expect(
        calculateCharge({
          baseFareCents: 5_000,
          actualUnits:   100,
          includedUnits: 100,
          scheduledEndAt: at('18:00'),
          actualEndAt:    at('20:00'), // exactly 2 h late
        }),
      ).toEqual({
        baseFareCents:     5_000,
        usageOverageCents: 0,
        lateFeeCents:      3_000,  // 2 × 1500
        amountCents:       8_000,
      });
    });

    it('rounds a partial hour up to the next full hour', () => {
      expect(
        calculateCharge({
          baseFareCents: 5_000,
          actualUnits:   100,
          includedUnits: 100,
          scheduledEndAt: at('18:00'),
          actualEndAt:    new Date('2024-01-01T18:01:00Z'), // 1 min late → 1 full hour
        }),
      ).toEqual({
        baseFareCents:     5_000,
        usageOverageCents: 0,
        lateFeeCents:      1_500,  // ceil(1/60) = 1 × 1500
        amountCents:       6_500,
      });
    });
  });

  describe('spec example — base $85, 37 overage units, 90 min late', () => {
    it('produces exactly $124.25 (12 425 cents)', () => {
      expect(
        calculateCharge({
          baseFareCents:  8_500,
          actualUnits:    237,
          includedUnits:  200,
          scheduledEndAt: new Date('2024-01-01T18:00:00Z'),
          actualEndAt:    new Date('2024-01-01T19:30:00Z'),
        }),
      ).toEqual({
        baseFareCents:     8_500,
        usageOverageCents: 925,    // 37 × 25
        lateFeeCents:      3_000,  // ceil(90 / 60) = 2 × 1500
        amountCents:       12_425,
      });
    });
  });
});
