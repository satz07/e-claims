import { BadRequestException } from '@nestjs/common';
import { DonationStep } from '../database/entities/donation.enums';

/**
 * Valid state transitions for the simplified donation lifecycle.
 *
 * INITIATED   → TRANSFERRED  : crypto confirmed in admin master wallet
 * TRANSFERRED → DISBURSED    : batch-applied when a milestone disbursement runs
 * Any step    → FAILED        : transfer or system error
 * Any step    → CANCELLED     : donor cancellation before transfer completes
 */
const VALID_TRANSITIONS: Record<DonationStep, DonationStep[]> = {
  [DonationStep.INITIATED]: [
    DonationStep.TRANSFERRED,
    DonationStep.FAILED,
    DonationStep.CANCELLED,
  ],
  [DonationStep.TRANSFERRED]: [DonationStep.DISBURSED, DonationStep.FAILED],

  // Terminal states — no further transitions allowed
  [DonationStep.DISBURSED]: [],
  [DonationStep.FAILED]: [],
  [DonationStep.CANCELLED]: [],
};

/**
 * Returns true if the transition from `fromStep` to `toStep` is valid.
 */
export function canTransition(
  fromStep: DonationStep,
  toStep: DonationStep,
): boolean {
  return VALID_TRANSITIONS[fromStep]?.includes(toStep) ?? false;
}

/**
 * Asserts a transition is valid. Throws BadRequestException if not.
 */
export function assertTransition(
  fromStep: DonationStep,
  toStep: DonationStep,
): void {
  if (!canTransition(fromStep, toStep)) {
    throw new BadRequestException(
      `Invalid donation step transition: ${fromStep} → ${toStep}`,
    );
  }
}

/**
 * Returns true if the step is a terminal state (no further transitions possible).
 */
export function isTerminalStep(step: DonationStep): boolean {
  return VALID_TRANSITIONS[step]?.length === 0;
}

/**
 * Get the list of valid next steps from a given step.
 */
export function getNextSteps(step: DonationStep): DonationStep[] {
  return VALID_TRANSITIONS[step] ?? [];
}
