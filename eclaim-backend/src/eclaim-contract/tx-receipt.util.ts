/** ethers v6 receipts expose `.hash`; v5 used `.transactionHash`. */
export function txHashFromReceipt(
  receipt: { hash?: string; transactionHash?: string } | null | undefined,
): string {
  if (!receipt) return '';
  return receipt.hash ?? receipt.transactionHash ?? '';
}
