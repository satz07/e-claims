import { ethers } from 'ethers';

/** ethers v6 receipts expose `.hash`; v5 used `.transactionHash`. */
export function txHashFromReceipt(
  receipt: ethers.ContractTransactionReceipt,
): string {
  return receipt.hash ?? (receipt as { transactionHash?: string }).transactionHash ?? '';
}
