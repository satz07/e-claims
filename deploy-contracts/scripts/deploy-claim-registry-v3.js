/**
 * Deploy ClaimRegistryV3 (multi-submitter) to the selected Hardhat network.
 *
 * After deploy, call addSubmitter() for each extra wallet that should be
 * allowed to submit claims in parallel.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-claim-registry-v3.js --network apeiro
 *
 * Optional env:
 *   EXTRA_SUBMITTERS  comma-separated addresses to authorize immediately
 *                     e.g. EXTRA_SUBMITTERS=0xABC...,0xDEF...
 */
import { network } from "hardhat";
import { resolveNetwork } from "../networks.js";
import { TxAuditLogger, deployAndLog } from "./lib/tx-logger.js";

const connection = await network.create();
const { ethers, networkName } = connection;

async function main() {
  const netMeta = resolveNetwork(networkName);
  const [signer] = await ethers.getSigners();
  const deployer = await signer.getAddress();
  const balance = await ethers.provider.getBalance(deployer);

  const logger = new TxAuditLogger(netMeta, { scriptName: "deploy-claim-registry-v3" });
  logger.logSessionStart(deployer, balance);

  console.log(`Deploying ClaimRegistryV3 on ${netMeta.name} (chain ${netMeta.chainId})…`);

  const { contract, address } = await deployAndLog(ethers, logger, "ClaimRegistryV3");
  const owner = await contract.owner();
  console.log("owner:", owner);

  // Wire up ProviderRegistry if env is set
  const providerAddr = process.env.PROVIDER_REGISTRY_ADDRESS;
  if (providerAddr) {
    console.log(`Setting ProviderRegistry → ${providerAddr}`);
    const tx = await contract.setProviderRegistry(providerAddr);
    await tx.wait();
    console.log("ProviderRegistry set.");
  }

  // Add extra submitters from env
  const extra = (process.env.EXTRA_SUBMITTERS || "").split(",").map(s => s.trim()).filter(Boolean);
  for (const addr of extra) {
    console.log(`Adding submitter: ${addr}`);
    const tx = await contract.addSubmitter(addr);
    await tx.wait();
    console.log(`  ✓ ${addr} authorized`);
  }

  const balanceAfter = await ethers.provider.getBalance(deployer);
  logger.logSessionEnd(balanceAfter);

  console.log("\nSet in backend / frontend env:");
  console.log(`CLAIM_REGISTRY_ADDRESS=${address}`);
  console.log(`# Old V1 contract (read-only for legacy data):`);
  console.log(`CLAIM_REGISTRY_V1_ADDRESS=0xA8eFbf955496518D6e3Cb10ABC90627671534088`);
  console.log(`\nTo add more submitters later:`);
  console.log(`  cast send ${address} "addSubmitter(address)" <WALLET_ADDRESS> --private-key <OWNER_KEY> --rpc-url ${netMeta.rpcUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
