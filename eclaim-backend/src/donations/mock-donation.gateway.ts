import { Injectable, Logger } from '@nestjs/common';
import {
  IDonationGateway,
  EscrowResult,
  BankReceivedResult,
  DisbursementResult,
} from './donations.gateway';

/**
 * MockDonationGateway — simulates all external system interactions.
 *
 * Returns immediate success with mock transaction IDs.
 * No timers, no async delays — simplest approach for dev/test.
 * Swap to LiveDonationGateway when integrating with real systems.
 */
@Injectable()
export class MockDonationGateway implements IDonationGateway {
  private readonly logger = new Logger(MockDonationGateway.name);

  async initiateEscrow(
    donationId: number,
    fromWallet: string,
    amount: string,
    currency: string,
  ): Promise<EscrowResult> {
    this.logger.log(
      `[MOCK] Escrow initiated: donation=${donationId}, from=${fromWallet}, amount=${amount} ${currency}`,
    );

    return {
      transactionId: `mock-escrow-tx-${donationId}-${Date.now()}`,
      success: true,
    };
  }

  async checkBankReceived(donationId: number): Promise<BankReceivedResult> {
    this.logger.log(`[MOCK] Bank received check: donation=${donationId}`);

    return {
      received: true,
      bankRef: `mock-bank-ref-${donationId}-${Date.now()}`,
    };
  }

  async disburseToGrantee(
    donationId: number,
    toWallet: string,
    amount: string,
    currency: string,
  ): Promise<DisbursementResult> {
    this.logger.log(
      `[MOCK] Disbursement initiated: donation=${donationId}, to=${toWallet}, amount=${amount} ${currency}`,
    );

    return {
      transactionId: `mock-disburse-tx-${donationId}-${Date.now()}`,
      success: true,
    };
  }
}
