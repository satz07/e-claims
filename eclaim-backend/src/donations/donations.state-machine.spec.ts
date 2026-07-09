import { DonationStep } from '../database/entities/donation.enums';
import {
  canTransition,
  assertTransition,
  isTerminalStep,
  getNextSteps,
} from './donations.state-machine';
import { BadRequestException } from '@nestjs/common';

describe('DonationsStateMachine', () => {
  describe('canTransition', () => {
    it('allows INITIATED → TRANSFERRED', () => {
      expect(
        canTransition(DonationStep.INITIATED, DonationStep.TRANSFERRED),
      ).toBe(true);
    });

    it('allows INITIATED → FAILED', () => {
      expect(canTransition(DonationStep.INITIATED, DonationStep.FAILED)).toBe(
        true,
      );
    });

    it('allows INITIATED → CANCELLED', () => {
      expect(
        canTransition(DonationStep.INITIATED, DonationStep.CANCELLED),
      ).toBe(true);
    });

    it('allows TRANSFERRED → DISBURSED', () => {
      expect(
        canTransition(DonationStep.TRANSFERRED, DonationStep.DISBURSED),
      ).toBe(true);
    });

    it('allows TRANSFERRED → FAILED', () => {
      expect(canTransition(DonationStep.TRANSFERRED, DonationStep.FAILED)).toBe(
        true,
      );
    });

    it('blocks INITIATED → DISBURSED (must go through TRANSFERRED)', () => {
      expect(
        canTransition(DonationStep.INITIATED, DonationStep.DISBURSED),
      ).toBe(false);
    });

    it('blocks DISBURSED → anything (terminal)', () => {
      expect(canTransition(DonationStep.DISBURSED, DonationStep.FAILED)).toBe(
        false,
      );
      expect(
        canTransition(DonationStep.DISBURSED, DonationStep.INITIATED),
      ).toBe(false);
    });

    it('blocks FAILED → anything (terminal)', () => {
      expect(canTransition(DonationStep.FAILED, DonationStep.TRANSFERRED)).toBe(
        false,
      );
    });

    it('blocks CANCELLED → anything (terminal)', () => {
      expect(
        canTransition(DonationStep.CANCELLED, DonationStep.INITIATED),
      ).toBe(false);
    });
  });

  describe('assertTransition', () => {
    it('throws for invalid transition', () => {
      expect(() =>
        assertTransition(DonationStep.DISBURSED, DonationStep.TRANSFERRED),
      ).toThrow(BadRequestException);
    });

    it('does not throw for valid transition', () => {
      expect(() =>
        assertTransition(DonationStep.INITIATED, DonationStep.TRANSFERRED),
      ).not.toThrow();
    });
  });

  describe('isTerminalStep', () => {
    it('marks DISBURSED, FAILED, CANCELLED as terminal', () => {
      expect(isTerminalStep(DonationStep.DISBURSED)).toBe(true);
      expect(isTerminalStep(DonationStep.FAILED)).toBe(true);
      expect(isTerminalStep(DonationStep.CANCELLED)).toBe(true);
    });

    it('does not mark INITIATED or TRANSFERRED as terminal', () => {
      expect(isTerminalStep(DonationStep.INITIATED)).toBe(false);
      expect(isTerminalStep(DonationStep.TRANSFERRED)).toBe(false);
    });
  });

  describe('getNextSteps', () => {
    it('returns [TRANSFERRED, FAILED, CANCELLED] for INITIATED', () => {
      const next = getNextSteps(DonationStep.INITIATED);
      expect(next).toContain(DonationStep.TRANSFERRED);
      expect(next).toContain(DonationStep.FAILED);
      expect(next).toContain(DonationStep.CANCELLED);
    });

    it('returns [DISBURSED, FAILED] for TRANSFERRED', () => {
      const next = getNextSteps(DonationStep.TRANSFERRED);
      expect(next).toContain(DonationStep.DISBURSED);
      expect(next).toContain(DonationStep.FAILED);
    });

    it('returns empty array for terminal states', () => {
      expect(getNextSteps(DonationStep.DISBURSED)).toHaveLength(0);
      expect(getNextSteps(DonationStep.FAILED)).toHaveLength(0);
      expect(getNextSteps(DonationStep.CANCELLED)).toHaveLength(0);
    });
  });
});
