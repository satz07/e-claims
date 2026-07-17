import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { explorerTxUrl, explorerAddressUrl } from "../../networks.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.join(__dirname, "..", "..", "logs");

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
}

function dayStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function weiToAdi(wei) {
  const n = BigInt(wei);
  const whole = n / 10n ** 18n;
  const frac = n % 10n ** 18n;
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "") || "0";
  return fracStr === "0" ? whole.toString() : `${whole}.${fracStr}`;
}

function gweiFromWei(wei) {
  return Number(BigInt(wei)) / 1e9;
}

/**
 * Append detailed deployment / tx audit logs for gas & mainnet cost analysis.
 * Writes:
 *   logs/deployments-YYYY-MM-DD.log   (human-readable)
 *   logs/deployments-YYYY-MM-DD.jsonl (machine-readable)
 */
export class TxAuditLogger {
  constructor(networkMeta, { scriptName = "unknown" } = {}) {
    ensureLogDir();
    this.network = networkMeta;
    this.scriptName = scriptName;
    this.sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.day = dayStamp();
    this.logPath = path.join(LOG_DIR, `deployments-${this.day}.log`);
    this.jsonlPath = path.join(LOG_DIR, `deployments-${this.day}.jsonl`);
    this.entries = [];
  }

  _append(text, record) {
    fs.appendFileSync(this.logPath, text.endsWith("\n") ? text : text + "\n");
    fs.appendFileSync(this.jsonlPath, JSON.stringify(record) + "\n");
    this.entries.push(record);
  }

  logSessionStart(signerAddress, balanceWei) {
    const record = {
      type: "session_start",
      sessionId: this.sessionId,
      script: this.scriptName,
      timestamp: new Date().toISOString(),
      network: {
        key: this.network.key,
        name: this.network.name,
        chainId: this.network.chainId,
        rpcUrl: this.network.rpcUrl,
        explorerUrl: this.network.explorerUrl,
        currency: this.network.currency?.symbol || "ADI",
        protocolVersion: this.network.protocolVersion || null,
        l1AdiToken: this.network.l1AdiToken || null,
        bridgehub: this.network.bridgehub || null,
        assetRouter: this.network.assetRouter || null,
      },
      deployer: signerAddress,
      balanceWei: balanceWei?.toString?.() ?? String(balanceWei),
      balanceAdi: weiToAdi(balanceWei),
    };

    const lines = [
      "",
      "══════════════════════════════════════════════════════════════════",
      `SESSION START  ${record.timestamp}`,
      `sessionId:     ${this.sessionId}`,
      `script:        ${this.scriptName}`,
      `network:       ${this.network.name} (${this.network.key})`,
      `chainId:       ${this.network.chainId}`,
      `rpc:           ${this.network.rpcUrl}`,
      `explorer:      ${this.network.explorerUrl}`,
      `deployer:      ${signerAddress}`,
      `balance:       ${record.balanceAdi} ADI`,
      ...(this.network.protocolVersion
        ? [`protocol:      ${this.network.protocolVersion}`]
        : []),
      "══════════════════════════════════════════════════════════════════",
      "",
    ];
    this._append(lines.join("\n"), record);
    console.log(lines.join("\n"));
  }

  /**
   * Log a mined tx (deploy or contract call) with full gas economics.
   */
  async logTransaction({
    label,
    contractName,
    contractAddress,
    tx,
    receipt,
    provider,
  }) {
    const gasUsed = receipt.gasUsed;
    const effectiveGasPrice =
      receipt.gasPrice ??
      receipt.effectiveGasPrice ??
      tx.gasPrice ??
      0n;
    const maxFeePerGas = tx.maxFeePerGas ?? null;
    const maxPriorityFeePerGas = tx.maxPriorityFeePerGas ?? null;
    const feeWei = BigInt(gasUsed) * BigInt(effectiveGasPrice);

    let block = null;
    try {
      if (provider && receipt.blockNumber != null) {
        block = await provider.getBlock(receipt.blockNumber);
      }
    } catch {
      /* optional */
    }

    const record = {
      type: "transaction",
      sessionId: this.sessionId,
      script: this.scriptName,
      timestamp: new Date().toISOString(),
      label,
      contractName: contractName || null,
      contractAddress: contractAddress || null,
      network: {
        key: this.network.key,
        name: this.network.name,
        chainId: this.network.chainId,
      },
      txHash: receipt.hash || tx.hash,
      from: receipt.from || tx.from,
      to: receipt.to || tx.to || null,
      nonce: tx.nonce ?? null,
      status: receipt.status === 1 || receipt.status === "success" ? "success" : "reverted",
      blockNumber: Number(receipt.blockNumber),
      blockTimestamp: block?.timestamp ? Number(block.timestamp) : null,
      confirmations: receipt.confirmations ?? null,
      gas: {
        gasLimit: tx.gasLimit?.toString?.() ?? null,
        gasUsed: gasUsed.toString(),
        gasUsedPct:
          tx.gasLimit != null
            ? Number((BigInt(gasUsed) * 10000n) / BigInt(tx.gasLimit)) / 100
            : null,
        maxFeePerGasWei: maxFeePerGas?.toString?.() ?? null,
        maxFeePerGasGwei: maxFeePerGas != null ? gweiFromWei(maxFeePerGas) : null,
        maxPriorityFeePerGasWei: maxPriorityFeePerGas?.toString?.() ?? null,
        maxPriorityFeePerGasGwei:
          maxPriorityFeePerGas != null ? gweiFromWei(maxPriorityFeePerGas) : null,
        effectiveGasPriceWei: effectiveGasPrice.toString(),
        effectiveGasPriceGwei: gweiFromWei(effectiveGasPrice),
        feePaidWei: feeWei.toString(),
        feePaidAdi: weiToAdi(feeWei),
        type: tx.type ?? null,
      },
      explorer: {
        tx: explorerTxUrl(this.network, receipt.hash || tx.hash),
        address: contractAddress
          ? explorerAddressUrl(this.network, contractAddress)
          : null,
      },
    };

    const lines = [
      `── TX: ${label} ──`,
      `  time:            ${record.timestamp}`,
      `  contract:        ${contractName || "—"} ${contractAddress || ""}`,
      `  txHash:          ${record.txHash}`,
      `  status:          ${record.status}`,
      `  block:           ${record.blockNumber}`,
      `  from:            ${record.from}`,
      `  gasLimit:        ${record.gas.gasLimit ?? "—"}`,
      `  gasUsed:         ${record.gas.gasUsed} (${record.gas.gasUsedPct ?? "—"}%)`,
      `  maxFee:          ${record.gas.maxFeePerGasGwei ?? "—"} gwei`,
      `  maxPriority:     ${record.gas.maxPriorityFeePerGasGwei ?? "—"} gwei`,
      `  effectivePrice:  ${record.gas.effectiveGasPriceGwei} gwei`,
      `  fee paid:        ${record.gas.feePaidAdi} ADI`,
      `  explorer:        ${record.explorer.tx}`,
      "",
    ];
    this._append(lines.join("\n"), record);
    console.log(lines.join("\n"));
    return record;
  }

  logSessionEnd(balanceAfterWei) {
    const txs = this.entries.filter((e) => e.type === "transaction");
    const totalFeeWei = txs.reduce(
      (acc, e) => acc + BigInt(e.gas?.feePaidWei || 0),
      0n,
    );
    const totalGasUsed = txs.reduce(
      (acc, e) => acc + BigInt(e.gas?.gasUsed || 0),
      0n,
    );

    const record = {
      type: "session_end",
      sessionId: this.sessionId,
      script: this.scriptName,
      timestamp: new Date().toISOString(),
      network: { key: this.network.key, chainId: this.network.chainId },
      txCount: txs.length,
      totalGasUsed: totalGasUsed.toString(),
      totalFeePaidWei: totalFeeWei.toString(),
      totalFeePaidAdi: weiToAdi(totalFeeWei),
      balanceAfterWei: balanceAfterWei?.toString?.() ?? null,
      balanceAfterAdi: balanceAfterWei != null ? weiToAdi(balanceAfterWei) : null,
      logFile: this.logPath,
      jsonlFile: this.jsonlPath,
    };

    const lines = [
      "══════════════════════════════════════════════════════════════════",
      `SESSION END    ${record.timestamp}`,
      `tx count:      ${record.txCount}`,
      `total gasUsed: ${record.totalGasUsed}`,
      `total fees:    ${record.totalFeePaidAdi} ADI`,
      ...(record.balanceAfterAdi
        ? [`balance after: ${record.balanceAfterAdi} ADI`]
        : []),
      `log:           ${this.logPath}`,
      `jsonl:         ${this.jsonlPath}`,
      "══════════════════════════════════════════════════════════════════",
      "",
    ];
    this._append(lines.join("\n"), record);
    console.log(lines.join("\n"));
    return record;
  }
}

/**
 * Deploy a contract and log full gas details.
 */
export async function deployAndLog(ethers, logger, contractName, args = []) {
  const factory = await ethers.getContractFactory(contractName);
  const contract = await factory.deploy(...args);
  const deploymentTx = contract.deploymentTransaction();
  await contract.waitForDeployment();
  const address = await contract.getAddress();
  const receipt = deploymentTx
    ? await deploymentTx.wait()
    : await ethers.provider.getTransactionReceipt(
        (await contract.deploymentTransaction())?.hash,
      );

  if (deploymentTx && receipt) {
    await logger.logTransaction({
      label: `deploy ${contractName}`,
      contractName,
      contractAddress: address,
      tx: deploymentTx,
      receipt,
      provider: ethers.provider,
    });
  }

  return { contract, address, receipt, deploymentTx };
}
