import * as fs from 'fs';
import * as path from 'path';
import { ethers } from 'ethers';
import { getActiveChain, explorerTxUrl } from './chain-config';

const LOG_DIR = path.join(process.cwd(), 'logs');

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}

function dayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function weiToAdi(wei: bigint | string | number): string {
  return ethers.formatEther(BigInt(wei));
}

/**
 * Append chain tx / gas audit records for mainnet cost analysis.
 * Files: logs/chain-tx-YYYY-MM-DD.log and .jsonl
 */
export async function logChainTransaction(opts: {
  label: string;
  contractName?: string;
  contractAddress?: string;
  tx: ethers.TransactionResponse;
  receipt: ethers.TransactionReceipt;
  provider: ethers.Provider;
  extra?: Record<string, unknown>;
}) {
  ensureLogDir();
  const net = getActiveChain();
  const day = dayStamp();
  const logPath = path.join(LOG_DIR, `chain-tx-${day}.log`);
  const jsonlPath = path.join(LOG_DIR, `chain-tx-${day}.jsonl`);

  const gasUsed = opts.receipt.gasUsed;
  const effectiveGasPrice =
    opts.receipt.gasPrice ??
    (opts.receipt as any).effectiveGasPrice ??
    opts.tx.gasPrice ??
    0n;
  const feeWei = gasUsed * BigInt(effectiveGasPrice);

  let balanceAfter: string | null = null;
  try {
    if (opts.receipt.from) {
      const bal = await opts.provider.getBalance(opts.receipt.from);
      balanceAfter = weiToAdi(bal);
    }
  } catch {
    /* optional */
  }

  let blockTimestamp: number | null = null;
  try {
    const block = await opts.provider.getBlock(opts.receipt.blockNumber);
    blockTimestamp = block?.timestamp ?? null;
  } catch {
    /* optional */
  }

  const record = {
    type: 'transaction',
    timestamp: new Date().toISOString(),
    label: opts.label,
    contractName: opts.contractName ?? null,
    contractAddress: opts.contractAddress ?? null,
    network: {
      key: net.key,
      name: net.name,
      chainId: net.chainId,
      rpcUrl: net.rpcUrl,
      explorerUrl: net.explorerUrl,
      protocolVersion: net.protocolVersion ?? null,
    },
    txHash: opts.receipt.hash,
    from: opts.receipt.from,
    to: opts.receipt.to,
    status: opts.receipt.status === 1 ? 'success' : 'reverted',
    blockNumber: opts.receipt.blockNumber,
    blockTimestamp,
    gas: {
      gasLimit: opts.tx.gasLimit?.toString() ?? null,
      gasUsed: gasUsed.toString(),
      maxFeePerGasWei: opts.tx.maxFeePerGas?.toString() ?? null,
      maxPriorityFeePerGasWei: opts.tx.maxPriorityFeePerGas?.toString() ?? null,
      effectiveGasPriceWei: effectiveGasPrice.toString(),
      effectiveGasPriceGwei: Number(effectiveGasPrice) / 1e9,
      feePaidWei: feeWei.toString(),
      feePaidAdi: weiToAdi(feeWei),
    },
    balanceAfterAdi: balanceAfter,
    explorerTx: explorerTxUrl(opts.receipt.hash),
    ...(opts.extra || {}),
  };

  const text = [
    `── ${opts.label} ──`,
    `  time:           ${record.timestamp}`,
    `  network:        ${net.name} (${net.chainId})`,
    `  txHash:         ${record.txHash}`,
    `  status:         ${record.status}`,
    `  gasUsed:        ${record.gas.gasUsed}`,
    `  effectivePrice: ${record.gas.effectiveGasPriceGwei} gwei`,
    `  fee paid:       ${record.gas.feePaidAdi} ADI`,
    `  balance after:  ${balanceAfter ?? '—'} ADI`,
    `  explorer:       ${record.explorerTx}`,
    '',
  ].join('\n');

  try {
    fs.appendFileSync(logPath, text);
    fs.appendFileSync(jsonlPath, JSON.stringify(record) + '\n');
  } catch (err) {
    console.error('[chain-tx-audit] failed to write log', err);
  }

  console.log(text);
  return record;
}

/** Wait for mining and append gas/fee audit log. */
export async function waitAndAudit(
  label: string,
  tx: ethers.TransactionResponse,
  provider: ethers.Provider,
  opts?: {
    contractName?: string;
    contractAddress?: string;
    extra?: Record<string, unknown>;
  },
) {
  const receipt = await tx.wait();
  if (!receipt) {
    throw new Error(`No receipt for ${label} (${tx.hash})`);
  }
  await logChainTransaction({
    label,
    tx,
    receipt,
    provider,
    contractName: opts?.contractName,
    contractAddress: opts?.contractAddress,
    extra: opts?.extra,
  });
  return receipt;
}

