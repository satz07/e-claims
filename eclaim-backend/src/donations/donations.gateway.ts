/**
 * IDonationGateway — interface for external system interactions.
 *
 * Two implementations:
 *   - MockDonationGateway: immediate success, no external calls (dev/test)
 *   - LiveDonationGateway: real wallet/bank APIs (future integration)
 */

export interface EscrowResult {
  transactionId: string;
  success: boolean;
  error?: string;
}

export interface BankReceivedResult {
  received: boolean;
  bankRef?: string;
  error?: string;
}

export interface DisbursementResult {
  transactionId: string;
  success: boolean;
  error?: string;
}

export interface IDonationGateway {
  /**
   * Flow 1: Initiate escrow transfer from donor wallet.
   */
  initiateEscrow(
    donationId: number,
    fromWallet: string,
    amount: string,
    currency: string,
  ): Promise<EscrowResult>;

  /**
   * Flow 2: Check if fiat has been received in system bank account.
   */
  checkBankReceived(donationId: number): Promise<BankReceivedResult>;

  /**
   * Common: Disburse funds/tokens to grantee wallet.
   */
  disburseToGrantee(
    donationId: number,
    toWallet: string,
    amount: string,
    currency: string,
  ): Promise<DisbursementResult>;
}

/** Injection token for the gateway */
export const DONATION_GATEWAY = 'DONATION_GATEWAY';
