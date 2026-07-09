import { BadRequestException } from '@nestjs/common';
import { MilestoneStatus } from '../database/entities/milestone.entity';

/**
 * Valid state transitions for the Milestone proof/approval lifecycle.
 *
 * PENDING         → IN_PROGRESS     : opportunity goes live
 * PENDING         → PROOF_SUBMITTED : business user submits proof documents (bypassing in_progress)
 * IN_PROGRESS     → PROOF_SUBMITTED : business user submits proof documents
 * PROOF_SUBMITTED → PROOF_SUBMITTED : business resubmits/updates proof before review
 * PROOF_SUBMITTED → COMPLETED       : admin approves proof
 * PROOF_SUBMITTED → PROOF_REJECTED  : admin rejects proof
 * PROOF_REJECTED  → PROOF_SUBMITTED : business resubmits after corrections
 * COMPLETED       → DISBURSED       : admin triggers batch disbursement
 */
const VALID_MILESTONE_TRANSITIONS: Record<MilestoneStatus, MilestoneStatus[]> =
  {
    [MilestoneStatus.PENDING]: [
      MilestoneStatus.IN_PROGRESS,
      MilestoneStatus.PROOF_SUBMITTED,
    ],
    [MilestoneStatus.IN_PROGRESS]: [MilestoneStatus.PROOF_SUBMITTED],
    [MilestoneStatus.PROOF_SUBMITTED]: [
      MilestoneStatus.COMPLETED,
      MilestoneStatus.PROOF_REJECTED,
      MilestoneStatus.PROOF_SUBMITTED,
    ],
    [MilestoneStatus.PROOF_REJECTED]: [MilestoneStatus.PROOF_SUBMITTED], // can resubmit
    [MilestoneStatus.COMPLETED]: [MilestoneStatus.DISBURSED],

    // Terminal states
    [MilestoneStatus.DISBURSED]: [],
  };

/**
 * Returns true if the transition from `from` to `to` is valid.
 */
export function canTransitionMilestone(
  from: MilestoneStatus,
  to: MilestoneStatus,
): boolean {
  return VALID_MILESTONE_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Asserts a milestone transition is valid. Throws BadRequestException if not.
 */
export function assertMilestoneTransition(
  from: MilestoneStatus,
  to: MilestoneStatus,
): void {
  if (!canTransitionMilestone(from, to)) {
    throw new BadRequestException(
      `Invalid milestone status transition: ${from} → ${to}`,
    );
  }
}

/**
 * Returns true if the milestone status is terminal.
 */
export function isMilestoneTerminal(status: MilestoneStatus): boolean {
  return VALID_MILESTONE_TRANSITIONS[status]?.length === 0;
}
