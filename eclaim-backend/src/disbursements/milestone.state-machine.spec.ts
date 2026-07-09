import { BadRequestException } from '@nestjs/common';
import { MilestoneStatus } from '../database/entities/milestone.entity';
import {
  canTransitionMilestone,
  assertMilestoneTransition,
  isMilestoneTerminal,
} from './milestone.state-machine';

describe('Milestone State Machine', () => {
  describe('canTransitionMilestone', () => {
    it('should return true for valid transitions', () => {
      expect(
        canTransitionMilestone(
          MilestoneStatus.PENDING,
          MilestoneStatus.IN_PROGRESS,
        ),
      ).toBe(true);
      expect(
        canTransitionMilestone(
          MilestoneStatus.PENDING,
          MilestoneStatus.PROOF_SUBMITTED,
        ),
      ).toBe(true);
      expect(
        canTransitionMilestone(
          MilestoneStatus.IN_PROGRESS,
          MilestoneStatus.PROOF_SUBMITTED,
        ),
      ).toBe(true);
      expect(
        canTransitionMilestone(
          MilestoneStatus.PROOF_SUBMITTED,
          MilestoneStatus.COMPLETED,
        ),
      ).toBe(true);
      expect(
        canTransitionMilestone(
          MilestoneStatus.PROOF_SUBMITTED,
          MilestoneStatus.PROOF_REJECTED,
        ),
      ).toBe(true);
      expect(
        canTransitionMilestone(
          MilestoneStatus.PROOF_REJECTED,
          MilestoneStatus.PROOF_SUBMITTED,
        ),
      ).toBe(true);
      expect(
        canTransitionMilestone(
          MilestoneStatus.COMPLETED,
          MilestoneStatus.DISBURSED,
        ),
      ).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      // Skipping states
      expect(
        canTransitionMilestone(
          MilestoneStatus.PENDING,
          MilestoneStatus.COMPLETED,
        ),
      ).toBe(false);
      expect(
        canTransitionMilestone(
          MilestoneStatus.IN_PROGRESS,
          MilestoneStatus.DISBURSED,
        ),
      ).toBe(false);

      // Going backward
      expect(
        canTransitionMilestone(
          MilestoneStatus.COMPLETED,
          MilestoneStatus.IN_PROGRESS,
        ),
      ).toBe(false);
      expect(
        canTransitionMilestone(
          MilestoneStatus.DISBURSED,
          MilestoneStatus.COMPLETED,
        ),
      ).toBe(false);

      // Terminal state transitioning to anything
      expect(
        canTransitionMilestone(
          MilestoneStatus.DISBURSED,
          MilestoneStatus.PENDING,
        ),
      ).toBe(false);
    });
  });

  describe('assertMilestoneTransition', () => {
    it('should not throw if transition is valid', () => {
      expect(() =>
        assertMilestoneTransition(
          MilestoneStatus.IN_PROGRESS,
          MilestoneStatus.PROOF_SUBMITTED,
        ),
      ).not.toThrow();
    });

    it('should throw BadRequestException if transition is invalid', () => {
      expect(() =>
        assertMilestoneTransition(
          MilestoneStatus.DISBURSED,
          MilestoneStatus.PROOF_SUBMITTED,
        ),
      ).toThrow(BadRequestException);

      expect(() =>
        assertMilestoneTransition(
          MilestoneStatus.COMPLETED,
          MilestoneStatus.PROOF_SUBMITTED,
        ),
      ).toThrow(
        'Invalid milestone status transition: completed → proof_submitted',
      );
    });
  });

  describe('isMilestoneTerminal', () => {
    it('should return true for DISBURSED', () => {
      expect(isMilestoneTerminal(MilestoneStatus.DISBURSED)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isMilestoneTerminal(MilestoneStatus.PENDING)).toBe(false);
      expect(isMilestoneTerminal(MilestoneStatus.IN_PROGRESS)).toBe(false);
      expect(isMilestoneTerminal(MilestoneStatus.PROOF_SUBMITTED)).toBe(false);
      expect(isMilestoneTerminal(MilestoneStatus.COMPLETED)).toBe(false);
      expect(isMilestoneTerminal(MilestoneStatus.PROOF_REJECTED)).toBe(false);
    });
  });
});
